/**
 * Native App Bridge
 * Provides communication between the web app and the React Native WebView
 * for push notifications and other native features.
 */

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    StudeseNative?: {
      isNativeApp: boolean;
      platform: 'ios' | 'android';
      pushToken: string | null;
      testNotification: () => void;
      scheduleNotification: (
        title: string,
        body: string,
        data?: Record<string, unknown>,
        delaySeconds?: number
      ) => void;
      cancelAllNotifications: () => void;
      getPushToken: () => string | null;
      registerPushToken: (userId: string) => void;
    };
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export interface NativeNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushTokenEvent {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Check if the app is running inside the native mobile app
 */
export function isNativeApp(): boolean {
  return !!window.StudeseNative?.isNativeApp;
}

/**
 * Get the platform (ios/android) if running in native app
 */
export function getNativePlatform(): 'ios' | 'android' | null {
  return window.StudeseNative?.platform || null;
}

/**
 * Get the push token if available
 */
export function getPushToken(): string | null {
  return window.StudeseNative?.pushToken || null;
}

/**
 * Send a test notification (for development purposes)
 */
export function sendTestNotification(): void {
  if (window.StudeseNative?.testNotification) {
    window.StudeseNative.testNotification();
  } else {
    console.warn('Native app bridge not available');
  }
}

/**
 * Schedule a local notification
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional data payload (used for navigation when tapped)
 * @param delaySeconds - Optional delay in seconds (0 = immediate)
 */
export function scheduleNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  delaySeconds?: number
): void {
  if (window.StudeseNative?.scheduleNotification) {
    window.StudeseNative.scheduleNotification(title, body, data, delaySeconds);
  } else {
    // Fallback to browser notifications if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      console.warn('Native app bridge not available, and browser notifications not permitted');
    }
  }
}

/**
 * Schedule a task reminder notification
 */
export function scheduleTaskReminder(
  taskTitle: string,
  taskId: string,
  delaySeconds: number
): void {
  scheduleNotification(
    '⏰ Task Reminder',
    `Don't forget: ${taskTitle}`,
    { type: 'task_reminder', taskId, route: '/tasks' },
    delaySeconds
  );
}

/**
 * Schedule an event reminder notification
 */
export function scheduleEventReminder(
  eventTitle: string,
  eventId: string,
  delaySeconds: number
): void {
  scheduleNotification(
    '📅 Event Starting Soon',
    eventTitle,
    { type: 'event_reminder', eventId, route: '/events' },
    delaySeconds
  );
}

/**
 * Cancel all scheduled notifications
 */
export function cancelAllNotifications(): void {
  if (window.StudeseNative?.cancelAllNotifications) {
    window.StudeseNative.cancelAllNotifications();
  }
}

/**
 * Register the push token with the backend
 * Call this after the user logs in
 */
export function registerPushTokenWithServer(userId: string): void {
  if (window.StudeseNative?.registerPushToken) {
    window.StudeseNative.registerPushToken(userId);
  }
}

/**
 * Listen for push token received event
 * @param callback - Function to call when token is received
 * @returns Cleanup function to remove listener
 */
export function onPushTokenReceived(
  callback: (event: PushTokenEvent) => void
): () => void {
  const handler = (e: CustomEvent<PushTokenEvent>) => {
    callback(e.detail);
  };

  window.addEventListener('pushTokenReceived', handler as EventListener);

  return () => {
    window.removeEventListener('pushTokenReceived', handler as EventListener);
  };
}

/**
 * Listen for notifications received while app is in foreground
 * @param callback - Function to call when notification is received
 * @returns Cleanup function to remove listener
 */
export function onNotificationReceived(
  callback: (notification: NativeNotification) => void
): () => void {
  const handler = (e: CustomEvent<NativeNotification>) => {
    callback(e.detail);
  };

  window.addEventListener('notificationReceived', handler as EventListener);

  return () => {
    window.removeEventListener('notificationReceived', handler as EventListener);
  };
}

/**
 * Listen for notification taps (user interacted with notification)
 * @param callback - Function to call when notification is tapped
 * @returns Cleanup function to remove listener
 */
export function onNotificationTapped(
  callback: (notification: NativeNotification) => void
): () => void {
  const handler = (e: CustomEvent<NativeNotification>) => {
    callback(e.detail);
  };

  window.addEventListener('notificationTapped', handler as EventListener);

  return () => {
    window.removeEventListener('notificationTapped', handler as EventListener);
  };
}

/**
 * Listen for app coming to foreground
 * @param callback - Function to call when app becomes active
 * @returns Cleanup function to remove listener
 */
export function onAppForeground(callback: () => void): () => void {
  // The native app will call window.onAppForeground
  (window as unknown as { onAppForeground?: () => void }).onAppForeground = callback;

  return () => {
    delete (window as unknown as { onAppForeground?: () => void }).onAppForeground;
  };
}

/**
 * Initialize native app features
 * Call this once when the app starts
 */
export function initNativeAppBridge(): void {
  if (!isNativeApp()) {
    console.log('Not running in native app, native bridge not initialized');
    return;
  }

  console.log(`Native app detected: ${getNativePlatform()}`);

  // Set up notification tap handler for navigation
  onNotificationTapped((notification) => {
    console.log('Notification tapped:', notification);

    // Handle navigation based on notification data
    const data = notification.data;
    if (data?.route && typeof data.route === 'string') {
      // Navigate to the specified route
      window.location.href = data.route;
    }
  });
}

/**
 * React hook for using push token
 * Use this in your app component to get and register the push token
 */
export function usePushToken(
  userId: string | null,
  onTokenReceived?: (token: string) => void
): string | null {
  // This is a simplified version - in actual use, you'd use useState and useEffect
  // to properly manage the token state

  if (typeof window === 'undefined') return null;

  const token = getPushToken();

  // If we have both token and userId, we can register
  if (token && userId) {
    registerPushTokenWithServer(userId);
    onTokenReceived?.(token);
  }

  return token;
}

// Export default object with all functions
export default {
  isNativeApp,
  getNativePlatform,
  getPushToken,
  sendTestNotification,
  scheduleNotification,
  scheduleTaskReminder,
  scheduleEventReminder,
  cancelAllNotifications,
  registerPushTokenWithServer,
  onPushTokenReceived,
  onNotificationReceived,
  onNotificationTapped,
  onAppForeground,
  initNativeAppBridge,
  usePushToken,
};
