import { ReactNode, useEffect, useState } from 'react';
import { isNativePlatform, isIOS, isAndroid, addKeyboardListeners } from '@/utils/mobile';

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  /**
   * Whether to apply safe area padding at the top (for notch/status bar)
   * @default true
   */
  safeTop?: boolean;
  /**
   * Whether to apply safe area padding at the bottom (for home indicator)
   * @default true
   */
  safeBottom?: boolean;
  /**
   * Whether to apply safe area padding on the sides (for landscape mode)
   * @default false
   */
  safeSides?: boolean;
  /**
   * Whether to adjust layout when keyboard is shown
   * @default true
   */
  adjustForKeyboard?: boolean;
}

/**
 * MobileLayout - A wrapper component that handles safe areas for iOS and Android
 *
 * This component ensures content doesn't overlap with:
 * - iOS notch / Dynamic Island
 * - iOS home indicator
 * - Android status bar
 * - Android navigation bar
 * - Keyboard when visible
 */
export const MobileLayout = ({
  children,
  className = '',
  safeTop = true,
  safeBottom = true,
  safeSides = false,
  adjustForKeyboard = true,
}: MobileLayoutProps) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!isNativePlatform() || !adjustForKeyboard) {
      return;
    }

    const cleanup = addKeyboardListeners(
      (height) => {
        setKeyboardHeight(height);
        setIsKeyboardVisible(true);
      },
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return cleanup;
  }, [adjustForKeyboard]);

  // Build safe area styles
  const safeAreaStyles: React.CSSProperties = {
    // paddingTop: safeTop ? 'env(safe-area-inset-top, 0px)' : undefined,
    paddingBottom: safeBottom && !isKeyboardVisible
      ? 'env(safe-area-inset-bottom, 0px)'
      : isKeyboardVisible
        ? `${keyboardHeight}px`
        : undefined,
    paddingLeft: safeSides ? 'env(safe-area-inset-left, 0px)' : undefined,
    paddingRight: safeSides ? 'env(safe-area-inset-right, 0px)' : undefined,
  };

  // Base classes for mobile layout
  const baseClasses = [
    'min-h-screen',
    'flex',
    'flex-col',
    isNativePlatform() ? 'mobile-layout' : '',
    isIOS() ? 'ios-layout' : '',
    isAndroid() ? 'android-layout' : '',
    isKeyboardVisible ? 'keyboard-visible' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={baseClasses}
      style={safeAreaStyles}
    >
      {children}
    </div>
  );
};

/**
 * MobileHeader - A header component that respects safe area at the top
 */
interface MobileHeaderProps {
  children: ReactNode;
  className?: string;
}

export const MobileHeader = ({ children, className = '' }: MobileHeaderProps) => {
  const headerStyles: React.CSSProperties = isNativePlatform() ? {
    paddingTop: 'env(safe-area-inset-top, 0px)',
  } : {};

  return (
    <header
      className={`sticky top-0 z-50 bg-background ${className}`}
      style={headerStyles}
    >
      {children}
    </header>
  );
};

/**
 * MobileFooter - A footer component that respects safe area at the bottom
 */
interface MobileFooterProps {
  children: ReactNode;
  className?: string;
}

export const MobileFooter = ({ children, className = '' }: MobileFooterProps) => {
  const footerStyles: React.CSSProperties = isNativePlatform() ? {
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  } : {};

  return (
    <footer
      className={`sticky bottom-0 z-50 bg-background ${className}`}
      style={footerStyles}
    >
      {children}
    </footer>
  );
};

/**
 * MobileContent - Scrollable content area between header and footer
 */
interface MobileContentProps {
  children: ReactNode;
  className?: string;
}

export const MobileContent = ({ children, className = '' }: MobileContentProps) => {
  return (
    <main className={`flex-1 overflow-y-auto ${className}`}>
      {children}
    </main>
  );
};

export default MobileLayout;
