/**
 * Native App Bridge
 * Re-exports mobile utilities and adds notification-specific types and helpers
 * for React Native WebView integration.
 */

// Re-export everything from mobile.ts
export {
  isNativePlatform,
  isExpoWebView,
  isCapacitor,
  getPlatform,
  isIOS,
  isAndroid,
  getPushToken,
  sendTestNotification,
  scheduleNotification,
  cancelAllNotifications,
  registerPushToken,
  postMessageToNative,
  initMobileApp,
  getSafeAreaInsets,
  getMobilePaddingClasses,
  vibrate,
  openExternalUrl,
  hasNotch,
} from "./mobile";

// Import for internal use
import { scheduleNotification as scheduleNotificationFn, isExpoWebView, getPlatform } from "./mobile";

// Alias for backwards compatibility
export { isExpoWebView as isNativeApp } from "./mobile";

// Types for notification events
export interface NativeNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushTokenEvent {
  token: string;
  platform: "ios" | "android";
}

/**
 * Schedule a task reminder notification
 */
export function scheduleTaskReminder(
  taskTitle: string,
  taskId: string,
  delaySeconds: number
): void {
  scheduleNotificationFn(
    "⏰ Task Reminder",
    `Don't forget: ${taskTitle}`,
    { type: "task_reminder", taskId, route: "/tasks" },
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
  scheduleNotificationFn(
    "📅 Event Starting Soon",
    eventTitle,
    { type: "event_reminder", eventId, route: "/events" },
    delaySeconds
  );
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

  window.addEventListener("pushTokenReceived", handler as EventListener);

  return () => {
    window.removeEventListener("pushTokenReceived", handler as EventListener);
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

  window.addEventListener("notificationReceived", handler as EventListener);

  return () => {
    window.removeEventListener("notificationReceived", handler as EventListener);
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

  window.addEventListener("notificationTapped", handler as EventListener);

  return () => {
    window.removeEventListener("notificationTapped", handler as EventListener);
  };
}

/**
 * Listen for app coming to foreground
 * @param callback - Function to call when app becomes active
 * @returns Cleanup function to remove listener
 */
export function onAppForeground(callback: () => void): () => void {
  (window as unknown as { onAppForeground?: () => void }).onAppForeground = callback;

  return () => {
    delete (window as unknown as { onAppForeground?: () => void }).onAppForeground;
  };
}

/**
 * Initialize native app features and listeners
 * Call this once when the app starts
 */
export function initNativeAppBridge(): void {
  if (!isExpoWebView()) {
    console.log("Not running in native app, native bridge not initialized");
    return;
  }

  console.log(`Native app detected: ${getPlatform()}`);

  // Set up notification tap handler for navigation
  onNotificationTapped((notification) => {
    console.log("Notification tapped:", notification);

    // Handle navigation based on notification data
    const data = notification.data;
    if (data?.route && typeof data.route === "string") {
      window.location.href = data.route;
    }
  });
}

// Export default object with all functions
export default {
  scheduleTaskReminder,
  scheduleEventReminder,
  onPushTokenReceived,
  onNotificationReceived,
  onNotificationTapped,
  onAppForeground,
  initNativeAppBridge,
};
