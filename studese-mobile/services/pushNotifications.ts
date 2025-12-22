import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Types
export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  url?: string;
}

/**
 * Register for push notifications and get the Expo push token
 * This token should be sent to your backend server to send notifications
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check if we're running in Expo Go (limited functionality)
  if (!Constants.expoConfig?.extra?.eas?.projectId) {
    console.log('Warning: EAS project ID not configured. Push notifications may not work in Expo Go.');
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission for push notifications was denied');
    return null;
  }

  try {
    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (projectId) {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = pushTokenData.data;
    } else {
      // Fallback for development without EAS
      const pushTokenData = await Notifications.getExpoPushTokenAsync();
      token = pushTokenData.data;
    }

    console.log('Expo Push Token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5B9BF3',
      sound: 'default',
    });

    // Create a channel for task reminders
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Task Reminders',
      description: 'Notifications for upcoming task deadlines',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF6B6B',
      sound: 'default',
    });

    // Create a channel for event notifications
    await Notifications.setNotificationChannelAsync('events', {
      name: 'Events',
      description: 'Notifications for upcoming events',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5B9BF3',
      sound: 'default',
    });
  }

  return token;
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  notification: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      sound: 'default',
    },
    trigger: trigger || null, // null means immediate
  });

  return notificationId;
}

/**
 * Schedule a notification for a specific date/time
 */
export async function scheduleNotificationAtDate(
  notification: NotificationData,
  date: Date,
  channelId?: string
): Promise<string> {
  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    channelId: channelId || 'default',
  };

  return scheduleLocalNotification(notification, trigger);
}

/**
 * Schedule a notification after a delay (in seconds)
 */
export async function scheduleNotificationAfterDelay(
  notification: NotificationData,
  seconds: number
): Promise<string> {
  const trigger: Notifications.TimeIntervalTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
  };

  return scheduleLocalNotification(notification, trigger);
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set the badge count (iOS only, Android handled automatically)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Add a notification received listener
 * Called when a notification is received while the app is in foreground
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a notification response listener
 * Called when user interacts with a notification (taps on it)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Remove a notification listener
 */
export function removeNotificationListener(subscription: Notifications.Subscription): void {
  subscription.remove();
}

/**
 * Send the push token to your backend server
 * This is where you'd integrate with Supabase or your own backend
 */
export async function sendPushTokenToServer(
  token: string,
  userId: string
): Promise<boolean> {
  try {
    // TODO: Replace with your actual backend endpoint
    // This could be a Supabase Edge Function or your own API
    const response = await fetch('https://studese.com/api/push-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        userId,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send push token to server:', error);
    return false;
  }
}

/**
 * Test sending a local notification (for development)
 */
export async function sendTestNotification(): Promise<void> {
  await scheduleLocalNotification({
    title: 'Test Notification',
    body: 'Push notifications are working!',
    data: { type: 'test' },
  });
}
