import 'dotenv/config';

export default {
  expo: {
    name: "Studese",
    slug: "studese",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "studese",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#121212"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.studese.app",
      backgroundColor: "#121212",
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        UIBackgroundModes: [
          "remote-notification"
        ],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["studese"]
          }
        ]
      },
      associatedDomains: [
        "applinks:studese.com",
        "applinks:studese.vercel.app"
      ]
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#121212"
      },
      edgeToEdgeEnabled: true,
      package: "com.studese.app",
      backgroundColor: "#121212",
      statusBar: {
        barStyle: "light-content",
        backgroundColor: "#121212"
      },
      permissions: [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "studese"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "studese.com",
              pathPrefix: "/success"
            },
            {
              scheme: "https",
              host: "studese.vercel.app",
              pathPrefix: "/success"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-splash-screen",
      [
        "expo-notifications",
        {
          color: "#5B9BF3",
          sounds: [
            "./assets/notification.mp3"
          ],
          defaultChannel: "default"
        }
      ],
      "expo-linking"
    ],
    notification: {
      color: "#5B9BF3",
      androidMode: "default",
      androidCollapsedTitle: "Studese"
    },
    extra: {
      // Read from .env file, fallback to production URL
      webUrl: process.env.WEB_URL || "https://studese.com",
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "your-project-id"
      }
    }
  }
};
