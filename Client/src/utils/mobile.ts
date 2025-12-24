/**
 * Mobile App Utilities
 * Supports both Capacitor and Expo WebView environments
 */

// Extend Window interface for native app bridges
declare global {
  interface Window {
    // Expo WebView bridge
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
    // React Native WebView postMessage
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    // Capacitor bridge
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => string;
    };
  }
}

/**
 * Check if running in Expo WebView (studese-mobile app)
 */
export const isExpoWebView = (): boolean => {
  return !!window.StudeseNative?.isNativeApp || !!window.ReactNativeWebView;
};

/**
 * Check if running in Capacitor
 */
export const isCapacitor = (): boolean => {
  return !!window.Capacitor?.isNativePlatform?.();
};

/**
 * Check if the app is running on any native platform (iOS/Android)
 * Works with both Capacitor and Expo WebView
 */
export const isNativePlatform = (): boolean => {
  return isExpoWebView() || isCapacitor();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  // Check Expo WebView first
  if (window.StudeseNative?.platform) {
    return window.StudeseNative.platform;
  }

  // Check Capacitor
  if (window.Capacitor?.getPlatform) {
    const platform = window.Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      return platform;
    }
  }

  // Fallback: detect from user agent
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }

  return 'web';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return getPlatform() === 'ios';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return getPlatform() === 'android';
};

/**
 * Get the push token if available (Expo WebView only)
 */
export const getPushToken = (): string | null => {
  return window.StudeseNative?.pushToken || null;
};

/**
 * Send a test notification (Expo WebView only)
 */
export const sendTestNotification = (): void => {
  if (window.StudeseNative?.testNotification) {
    window.StudeseNative.testNotification();
  } else {
    console.warn('Test notifications require the native app');
  }
};

/**
 * Schedule a local notification (Expo WebView only)
 */
export const scheduleNotification = (
  title: string,
  body: string,
  data?: Record<string, unknown>,
  delaySeconds?: number
): void => {
  if (window.StudeseNative?.scheduleNotification) {
    window.StudeseNative.scheduleNotification(title, body, data, delaySeconds);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // Fallback to browser notifications
    if (delaySeconds && delaySeconds > 0) {
      setTimeout(() => {
        new Notification(title, { body });
      }, delaySeconds * 1000);
    } else {
      new Notification(title, { body });
    }
  } else {
    console.warn('Notifications not available in this environment');
  }
};

/**
 * Cancel all scheduled notifications (Expo WebView only)
 */
export const cancelAllNotifications = (): void => {
  if (window.StudeseNative?.cancelAllNotifications) {
    window.StudeseNative.cancelAllNotifications();
  }
};

/**
 * Register push token with server (Expo WebView only)
 */
export const registerPushToken = (userId: string): void => {
  if (window.StudeseNative?.registerPushToken) {
    window.StudeseNative.registerPushToken(userId);
  }
};

/**
 * Post a message to the native app (Expo WebView)
 */
export const postMessageToNative = (type: string, data?: Record<string, unknown>): void => {
  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
  }
};

/**
 * Initialize mobile-specific features
 * Call this in your App.tsx useEffect
 */
export const initMobileApp = async (): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('Running in web browser');
    return;
  }

  const platform = getPlatform();
  const isExpo = isExpoWebView();

  console.log(`Mobile app initialized: ${platform} (${isExpo ? 'Expo' : 'Capacitor'})`);

  // Set up event listeners for native app events
  if (isExpo) {
    setupExpoListeners();
  }

  // Add mobile-specific CSS class to body
  document.body.classList.add('native-app');
  document.body.classList.add(`platform-${platform}`);
};

/**
 * Set up listeners for Expo WebView events
 */
const setupExpoListeners = (): void => {
  // Listen for messages from native app
  window.addEventListener('message', handleNativeMessage);

  // Listen for push token
  window.addEventListener('pushTokenReceived', ((event: CustomEvent) => {
    console.log('Push token received:', event.detail?.token);
  }) as EventListener);

  // Listen for notifications
  window.addEventListener('notificationReceived', ((event: CustomEvent) => {
    console.log('Notification received:', event.detail);
  }) as EventListener);

  window.addEventListener('notificationTapped', ((event: CustomEvent) => {
    console.log('Notification tapped:', event.detail);
    // Handle navigation based on notification data
    const data = event.detail?.data;
    if (data?.route) {
      window.location.href = data.route;
    }
  }) as EventListener);
};

/**
 * Handle messages from native app
 */
const handleNativeMessage = (event: MessageEvent): void => {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    switch (data.type) {
      case 'PUSH_TOKEN':
        console.log('Push token received via message:', data.token);
        // Store or use the token
        break;

      case 'NOTIFICATION_RECEIVED':
        console.log('Notification received via message:', data.notification);
        break;

      case 'NOTIFICATION_TAPPED':
        console.log('Notification tapped via message:', data.notification);
        if (data.notification?.data?.route) {
          window.location.href = data.notification.data.route;
        }
        break;

      default:
        // Unknown message type
        break;
    }
  } catch {
    // Not a JSON message, ignore
  }
};

/**
 * Get safe area insets for iOS notch/dynamic island
 */
export const getSafeAreaInsets = (): {
  top: string;
  bottom: string;
  left: string;
  right: string;
} => {
  return {
    top: 'env(safe-area-inset-top, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
  };
};

/**
 * Utility to apply safe area padding classes
 * Use with Tailwind: className={getMobilePaddingClasses()}
 */
export const getMobilePaddingClasses = (): string => {
  if (!isNativePlatform()) {
    return '';
  }
  return 'pb-safe pl-safe pr-safe';
};

/**
 * Vibrate the device (haptic feedback)
 */
export const vibrate = (duration: number = 50): void => {
  if (isNativePlatform() && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
};

/**
 * Open external URL in system browser
 */
export const openExternalUrl = (url: string): void => {
  if (isExpoWebView()) {
    // Post message to native app to open in browser
    postMessageToNative('EXTERNAL_LINK', { url });
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Check if device has a notch (iPhone X and later)
 */
export const hasNotch = (): boolean => {
  if (!isNativePlatform() || !isIOS()) {
    return false;
  }

  // Check if safe area inset is greater than default status bar
  const style = getComputedStyle(document.documentElement);
  const topInset = parseInt(style.getPropertyValue('--sat').replace('px', '') || '0');
  return topInset > 20;
};

// Export default object with all functions
export default {
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
};
