import { useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ArrowLeftCircle } from 'lucide-react';

interface SafeAreaProviderProps {
  children: ReactNode;
}

// Theme colors - must match your CSS variables
const THEME_COLORS = {
  light: {
    background: '#fcfcfc', // hsl(0 0% 99%)
    statusBarStyle: Style.Light, // Dark text for light background
  },
  dark: {
    background: '#121212', // hsl(0 0% 7.1%)
    statusBarStyle: Style.Dark, // Light text for dark background
  },
};

/**
 * SafeAreaProvider - Handles dynamic theming for native safe areas
 *
 * This component:
 * 1. Updates the iOS/Android status bar style based on theme
 * 2. Updates the meta theme-color for the browser/PWA
 * 3. Sets the HTML background color to prevent flash on theme change
 */
export const SafeAreaProvider = ({ children }: SafeAreaProviderProps) => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const updateThemeColors = async () => {
      const isDark = resolvedTheme === 'dark';
      const colors = isDark ? THEME_COLORS.light : THEME_COLORS.dark;

      // Update HTML and body background color
      document.documentElement.style.backgroundColor = colors.background;
      document.body.style.backgroundColor = colors.background;

      // Update meta theme-color tag (for browser address bar and PWA)
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', colors.background);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = colors.background;
        document.head.appendChild(meta);
      }

      // Update native status bar if running in Capacitor
      if (Capacitor.isNativePlatform()) {
        try {
          // Set status bar style (light/dark text)
          await StatusBar.setStyle({ style: colors.statusBarStyle });

          // On Android, also set the background color
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: colors.background });
          }
        } catch (error) {
          console.error('Error updating status bar:', error);
        }
      }
    };

    // Run on mount and theme change
    updateThemeColors();
  }, [resolvedTheme]);

  return (
    <div className="safe-area-wrapper min-h-screen bg-background">
      {/* Status bar background that matches theme */}

      <div
        // className="status-bar-bg fixed -top-12 left-0 right-0 bg-background"
        // style={{
        //   height: 'env(0px, 0px)',
        // }}
        aria-hidden="true"
      />
      {Capacitor.isNativePlatform() && <button className='fixed text-black absolute z-[99999] p-4 top-[4rem]'
        onClick={() => window.history.back()}>
        <ArrowLeftCircle size={32} className='text-black dark:text-white' />
      </button>}
      {/* Main content */}
      {children}

      {/* Bottom safe area background for home indicator */}
      {/*<div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-background"
        // style={{
        //   height: 'env(0px, 0px)',
        // }}
        aria-hidden="true"
      />*/}
    </div>
  );
};

export default SafeAreaProvider;
