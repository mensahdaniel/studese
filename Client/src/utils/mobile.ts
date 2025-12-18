import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Check if the app is running on a native platform (iOS/Android)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Initialize mobile-specific features
 * Call this in your App.tsx useEffect
 */
export const initMobileApp = async (): Promise<void> => {
  if (!isNativePlatform()) {
    return;
  }

  try {
    // Configure status bar
    await setupStatusBar();

    // Handle back button on Android
    setupBackButton();

    // Handle app state changes
    setupAppStateListener();

    // Hide splash screen after initialization
    await SplashScreen.hide();

    console.log('Mobile app initialized successfully');
  } catch (error) {
    console.error('Error initializing mobile app:', error);
  }
};

/**
 * Setup status bar styling
 */
const setupStatusBar = async (): Promise<void> => {
  try {
    // Set dark style (light text for dark backgrounds)
    await StatusBar.setStyle({ style: Style.Dark });

    if (isAndroid()) {
      // Make status bar transparent on Android
      await StatusBar.setBackgroundColor({ color: '#000000' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (error) {
    console.error('Error setting up status bar:', error);
  }
};

/**
 * Setup Android back button handling
 */
const setupBackButton = (): void => {
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      // Optionally show exit confirmation or just exit
      App.exitApp();
    }
  });
};

/**
 * Setup app state change listeners
 */
const setupAppStateListener = (): void => {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      // App came to foreground
      console.log('App is active');
      // You can refresh data, reconnect websockets, etc.
    } else {
      // App went to background
      console.log('App is in background');
      // You can pause timers, save state, etc.
    }
  });

  // Handle app URL open (deep links)
  App.addListener('appUrlOpen', ({ url }) => {
    console.log('App opened with URL:', url);
    // Handle deep linking here
    // Example: navigate to specific routes based on URL
    handleDeepLink(url);
  });
};

/**
 * Handle deep linking
 */
const handleDeepLink = (url: string): void => {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Navigate based on path
    // This integrates with react-router
    if (path) {
      window.location.hash = path;
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
};

/**
 * Show keyboard (useful for focusing inputs)
 */
export const showKeyboard = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      await Keyboard.show();
    } catch (error) {
      console.error('Error showing keyboard:', error);
    }
  }
};

/**
 * Hide keyboard
 */
export const hideKeyboard = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      await Keyboard.hide();
    } catch (error) {
      console.error('Error hiding keyboard:', error);
    }
  }
};

/**
 * Add keyboard show/hide listeners
 */
export const addKeyboardListeners = (
  onShow?: (height: number) => void,
  onHide?: () => void
): (() => void) => {
  if (!isNativePlatform()) {
    return () => { };
  }

  const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
    onShow?.(info.keyboardHeight);
  });

  const hideListener = Keyboard.addListener('keyboardWillHide', () => {
    onHide?.();
  });

  // Return cleanup function
  return () => {
    showListener.then((l) => l.remove());
    hideListener.then((l) => l.remove());
  };
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
 * Check if device has a notch (iPhone X and later)
 */
export const hasNotch = (): boolean => {
  if (!isNativePlatform() || !isIOS()) {
    return false;
  }

  // Check if safe area inset is greater than default status bar
  const topInset = parseInt(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--sat')
      .replace('px', '') || '0'
  );

  return topInset > 20;
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
export const openExternalUrl = async (url: string): Promise<void> => {
  if (isNativePlatform()) {
    // On native, use capacitor browser or system browser
    window.open(url, '_system');
  } else {
    window.open(url, '_blank');
  }
};
