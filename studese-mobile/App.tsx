import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, BackHandler, Platform, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const STUDESE_URL = 'https://studese.com';

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

  const handleLoadEnd = async () => {
    setIsLoading(false);
    await SplashScreen.hideAsync();
  };

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
    })();
    true;
  `;

  // Handle messages from WebView
  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'EXTERNAL_LINK' && data.url) {
        // Open external link in system browser
        Linking.openURL(data.url);
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
