import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studese.app',
  appName: 'Studese',
  webDir: 'dist',
  server: {
    // url: 'http://192.168.100.7:8080',
    // cleartext: true,

    // Production settings
    androidScheme: 'https',
    iosScheme: 'https',
  },
  // plugins: {
  //   SplashScreen: {
  //     launchShowDuration: 2000,
  //     launchAutoHide: true,
  //     backgroundColor: '#121212',
  //     androidSplashResourceName: 'splash',
  //     androidScaleType: 'CENTER_CROP',
  //     showSpinner: false,
  //     splashFullScreen: true,
  //     splashImmersive: true,
  //   },
  StatusBar: {
    style: 'dark',
    backgroundColor: '#121212',
  },
  Keyboard: {
    resize: 'body',
    resizeOnFullScreen: true,
  },
  PushNotifications: {
    presentationOptions: ['badge', 'sound', 'alert'],
  },
},
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Studese',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#121212',
  },
};

export default config;
