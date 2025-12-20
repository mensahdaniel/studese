import { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, BackHandler, Platform, ActivityIndicator, Linking, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationListener,
  sendTestNotification,
} from './services/pushNotifications';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const STUDESE_URL = 'https://studese.com';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Check if URL is internal (contains "studese")
const isInternalUrl = (url: string): boolean => {
  try {
    const urlLower = url.toLowerCase();
    return urlLower.includes('studese');
  } catch {
    return false;
  }
};

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const appState = useRef(AppState.currentState);

  // Register for push notifications on mount
  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token: string | null) => {
      if (token) {
        setExpoPushToken(token);
        console.log('Push token registered:', token);
      }
    });

    // Listen for notifications received while app is in foreground
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);

      // Optionally send notification data to WebView
      if (webViewRef.current) {
        const message = JSON.stringify({
          type: 'NOTIFICATION_RECEIVED',
          notification: {
            title: notification.request.content.title,
            body: notification.request.content.body,
            data: notification.request.content.data,
          },
        });
        webViewRef.current.postMessage(message);
      }
    });

    // Listen for notification taps (user interacts with notification)
    responseListener.current = addNotificationResponseListener((response) => {
      console.log('Notification tapped:', response);

      const data = response.notification.request.content.data;

      // Handle navigation based on notification data
      if (data?.url && typeof data.url === 'string') {
        // Navigate to specific page in WebView
        if (webViewRef.current && isInternalUrl(data.url)) {
          webViewRef.current.injectJavaScript(`
            window.location.href = '${data.url}';
            true;
          `);
        } else if (data.url) {
          Linking.openURL(data.url);
        }
      } else if (data?.route && typeof data.route === 'string') {
        // Navigate to route within the app
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.location.href = '${STUDESE_URL}${data.route}';
            true;
          `);
        }
      }

      // Send notification tap event to WebView
      if (webViewRef.current) {
        const message = JSON.stringify({
          type: 'NOTIFICATION_TAPPED',
          notification: {
            title: response.notification.request.content.title,
            body: response.notification.request.content.body,
            data: response.notification.request.content.data,
          },
        });
        webViewRef.current.postMessage(message);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        removeNotificationListener(notificationListener.current);
      }
      if (responseListener.current) {
        removeNotificationListener(responseListener.current);
      }
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - refresh badge count or check for updates
        console.log('App has come to foreground');

        // Optionally notify WebView that app is active
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.onAppForeground) {
              window.onAppForeground();
            }
            true;
          `);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Prevent default behavior
        }
        return false; // Allow default behavior (exit app)
      });

      return () => backHandler.remove();
    }
  }, [canGoBack]);

  const handleLoadEnd = useCallback(async () => {
    setIsLoading(false);
    await SplashScreen.hideAsync();

    // Send push token to WebView after load
    if (expoPushToken && webViewRef.current) {
      const message = JSON.stringify({
        type: 'PUSH_TOKEN',
        token: expoPushToken,
        platform: Platform.OS,
      });
      webViewRef.current.postMessage(message);
    }
  }, [expoPushToken]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  // Handle URL requests - open external links in browser
  const handleShouldStartLoadWithRequest = (request: { url: string }): boolean => {
    const { url } = request;

    // Allow initial load and internal navigation
    if (isInternalUrl(url)) {
      return true; // Load in WebView
    }

    // Handle special protocols (tel:, mailto:, etc.)
    if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
      Linking.openURL(url);
      return false;
    }

    Linking.openURL(url);
    return false; // Don't load in WebView
  };

  // JavaScript to inject into the WebView for better mobile experience
  const injectedJavaScript = `
    (function() {
      // Disable long-press context menu
      document.body.style.webkitTouchCallout = 'none';
      document.body.style.webkitUserSelect = 'none';

      // Add viewport meta if not present
      if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
      }

      // Set up native app bridge
      window.StudeseNative = {
        isNativeApp: true,
        platform: '${Platform.OS}',
        pushToken: null,

        // Request a test notification (for development)
        testNotification: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'TEST_NOTIFICATION'
          }));
        },

        // Schedule a local notification
        scheduleNotification: function(title, body, data, delaySeconds) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCHEDULE_NOTIFICATION',
            title: title,
            body: body,
            data: data || {},
            delaySeconds: delaySeconds || 0
          }));
        },

        // Cancel all notifications
        cancelAllNotifications: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CANCEL_ALL_NOTIFICATIONS'
          }));
        },

        // Get push token
        getPushToken: function() {
          return this.pushToken;
        },

        // Send push token to your server
        registerPushToken: function(userId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REGISTER_PUSH_TOKEN',
            userId: userId
          }));
        }
      };

      // Listen for messages from React Native
      window.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'PUSH_TOKEN') {
            window.StudeseNative.pushToken = data.token;
            console.log('Push token received:', data.token);

            // Dispatch custom event for the web app to handle
            window.dispatchEvent(new CustomEvent('pushTokenReceived', {
              detail: { token: data.token, platform: data.platform }
            }));
          }

          if (data.type === 'NOTIFICATION_RECEIVED') {
            console.log('Notification received in foreground:', data.notification);
            window.dispatchEvent(new CustomEvent('notificationReceived', {
              detail: data.notification
            }));
          }

          if (data.type === 'NOTIFICATION_TAPPED') {
            console.log('Notification was tapped:', data.notification);
            window.dispatchEvent(new CustomEvent('notificationTapped', {
              detail: data.notification
            }));
          }
        } catch (e) {
          // Not a JSON message, ignore
        }
      });

      // Intercept link clicks to handle external URLs
      document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
          const href = target.href.toLowerCase();
          // If link doesn't contain 'studese', let React Native handle it
          if (!href.includes('studese')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXTERNAL_LINK',
              url: target.href
            }));
          }
        }
      }, true);

      // Notify React Native that the page is ready
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_LOADED' }));

      console.log('StudeseNative bridge initialized');
    })();
    true;
  `;

  // Handle messages from WebView
  const handleMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'EXTERNAL_LINK':
          if (data.url) {
            Linking.openURL(data.url);
          }
          break;

        case 'TEST_NOTIFICATION':
          await sendTestNotification();
          break;

        case 'SCHEDULE_NOTIFICATION':
          const { scheduleNotificationAfterDelay, scheduleLocalNotification } = await import('./services/pushNotifications');
          if (data.delaySeconds && data.delaySeconds > 0) {
            await scheduleNotificationAfterDelay(
              { title: data.title, body: data.body, data: data.data },
              data.delaySeconds
            );
          } else {
            await scheduleLocalNotification(
              { title: data.title, body: data.body, data: data.data }
            );
          }
          break;

        case 'CANCEL_ALL_NOTIFICATIONS':
          const { cancelAllNotifications } = await import('./services/pushNotifications');
          await cancelAllNotifications();
          break;

        case 'REGISTER_PUSH_TOKEN':
          if (expoPushToken && data.userId) {
            const { sendPushTokenToServer } = await import('./services/pushNotifications');
            await sendPushTokenToServer(expoPushToken, data.userId);
          }
          break;

        case 'PAGE_LOADED':
          console.log('WebView page loaded');
          // Send push token again in case it was set before the page loaded
          if (expoPushToken && webViewRef.current) {
            const message = JSON.stringify({
              type: 'PUSH_TOKEN',
              token: expoPushToken,
              platform: Platform.OS,
            });
            webViewRef.current.postMessage(message);
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.warn('Failed to parse WebView message:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" backgroundColor="#121212" />

        <WebView
          ref={webViewRef}
          source={{ uri: STUDESE_URL }}
          style={styles.webview}
          onLoadEnd={handleLoadEnd}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsBackForwardNavigationGestures={true}
          pullToRefreshEnabled={true}
          cacheEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          originWhitelist={['*']}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5B9BF3" />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('HTTP error:', nativeEvent.statusCode);
          }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5B9BF3" />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  webview: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});
