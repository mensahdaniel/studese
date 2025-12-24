/**
 * React Hook for Push Notifications
 * Provides easy access to push notification functionality in React components
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import {
  isNativeApp,
  getPushToken,
  onPushTokenReceived,
  onNotificationReceived,
  onNotificationTapped,
  scheduleNotification,
  scheduleTaskReminder,
  scheduleEventReminder,
  cancelAllNotifications,
  sendTestNotification,
  NativeNotification,
  PushTokenEvent,
} from "@/utils/nativeApp";
import {
  registerPushToken,
  initializePushNotifications,
  cleanupPushNotifications,
  sendPushToCurrentUser,
  PushNotificationPayload,
} from "@/utils/pushNotifications";

export interface UsePushNotificationsState {
  isNative: boolean;
  isReady: boolean;
  pushToken: string | null;
  platform: "ios" | "android" | null;
  permissionGranted: boolean;
  lastNotification: NativeNotification | null;
}

export interface UsePushNotificationsActions {
  // Request/refresh push token
  refreshToken: () => Promise<void>;
  // Send a test notification (for development)
  sendTest: () => void;
  // Schedule a local notification
  scheduleLocal: (
    title: string,
    body: string,
    data?: Record<string, unknown>,
    delaySeconds?: number
  ) => void;
  // Schedule a task reminder
  scheduleTaskReminder: (
    taskTitle: string,
    taskId: string,
    delaySeconds: number
  ) => void;
  // Schedule an event reminder
  scheduleEventReminder: (
    eventTitle: string,
    eventId: string,
    delaySeconds: number
  ) => void;
  // Cancel all scheduled notifications
  cancelAll: () => void;
  // Send a push notification to the current user (server-side)
  sendPush: (
    notification: PushNotificationPayload
  ) => Promise<{ success: boolean; error?: string }>;
  // Cleanup (call on logout)
  cleanup: () => Promise<void>;
}

export type UsePushNotificationsReturn = UsePushNotificationsState &
  UsePushNotificationsActions;

/**
 * Hook for managing push notifications
 * Automatically initializes when mounted and handles token registration
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<UsePushNotificationsState>({
    isNative: false,
    isReady: false,
    pushToken: null,
    platform: null,
    permissionGranted: false,
    lastNotification: null,
  });

  // Initialize push notifications
  useEffect(() => {
    const init = async () => {
      const native = isNativeApp();

      if (!native) {
        setState((prev) => ({
          ...prev,
          isNative: false,
          isReady: true,
        }));
        return;
      }

      // Get current token if available
      const token = getPushToken();
      const platform = (window.StudeseNative?.platform || null) as
        | "ios"
        | "android"
        | null;

      setState((prev) => ({
        ...prev,
        isNative: true,
        pushToken: token,
        platform,
        permissionGranted: !!token,
        isReady: true,
      }));

      // Initialize and register token with server
      await initializePushNotifications();
    };

    init();

    // Listen for new tokens
    const unsubscribeToken = onPushTokenReceived(
      async (event: PushTokenEvent) => {
        setState((prev) => ({
          ...prev,
          pushToken: event.token,
          platform: event.platform,
          permissionGranted: true,
        }));

        // Register with server
        await registerPushToken(event.token, event.platform);
      }
    );

    // Listen for notifications received in foreground
    const unsubscribeReceived = onNotificationReceived(
      (notification: NativeNotification) => {
        setState((prev) => ({
          ...prev,
          lastNotification: notification,
        }));
      }
    );

    // Listen for notification taps
    const unsubscribeTapped = onNotificationTapped(
      (notification: NativeNotification) => {
        setState((prev) => ({
          ...prev,
          lastNotification: notification,
        }));
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribeToken();
      unsubscribeReceived();
      unsubscribeTapped();
    };
  }, []);

  // Re-register token when user changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" && state.pushToken && state.platform) {
        // User signed in, register token
        await registerPushToken(state.pushToken, state.platform);
      } else if (event === "SIGNED_OUT") {
        // User signed out, cleanup
        await cleanupPushNotifications();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [state.pushToken, state.platform]);

  // Actions
  const refreshToken = useCallback(async () => {
    if (!state.isNative) return;

    const token = getPushToken();
    if (token && state.platform) {
      await registerPushToken(token, state.platform);
      setState((prev) => ({
        ...prev,
        pushToken: token,
        permissionGranted: true,
      }));
    }
  }, [state.isNative, state.platform]);

  const sendTest = useCallback(() => {
    if (!state.isNative) {
      console.warn("Test notifications only work in native app");
      return;
    }
    sendTestNotification();
  }, [state.isNative]);

  const scheduleLocal = useCallback(
    (
      title: string,
      body: string,
      data?: Record<string, unknown>,
      delaySeconds?: number
    ) => {
      scheduleNotification(title, body, data, delaySeconds);
    },
    []
  );

  const scheduleTask = useCallback(
    (taskTitle: string, taskId: string, delaySeconds: number) => {
      scheduleTaskReminder(taskTitle, taskId, delaySeconds);
    },
    []
  );

  const scheduleEvent = useCallback(
    (eventTitle: string, eventId: string, delaySeconds: number) => {
      scheduleEventReminder(eventTitle, eventId, delaySeconds);
    },
    []
  );

  const cancelAll = useCallback(() => {
    cancelAllNotifications();
  }, []);

  const sendPush = useCallback(
    async (
      notification: PushNotificationPayload
    ): Promise<{ success: boolean; error?: string }> => {
      return sendPushToCurrentUser(notification);
    },
    []
  );

  const cleanup = useCallback(async () => {
    await cleanupPushNotifications();
    setState((prev) => ({
      ...prev,
      pushToken: null,
      permissionGranted: false,
    }));
  }, []);

  return {
    // State
    ...state,
    // Actions
    refreshToken,
    sendTest,
    scheduleLocal,
    scheduleTaskReminder: scheduleTask,
    scheduleEventReminder: scheduleEvent,
    cancelAll,
    sendPush,
    cleanup,
  };
}

export default usePushNotifications;
