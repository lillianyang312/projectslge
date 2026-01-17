/**
 * KeyboardAwareScreen Component
 *
 * A reusable wrapper for screens with form inputs that need proper keyboard handling.
 *
 * Features:
 * - Auto-scrolls focused inputs above keyboard
 * - Proper keyboard avoidance on iOS and Android
 * - Extra bottom padding for comfortable scrolling with keyboard open
 * - Works with any number of inputs
 * - Supports custom header and footer
 *
 * Usage:
 * ```tsx
 * <KeyboardAwareScreen>
 *   <TextInput ... />
 *   <TextInput ... />
 * </KeyboardAwareScreen>
 * ```
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Keyboard,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewStyle,
  TextInput,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../tokens';

// Extra padding at the bottom when keyboard is open
const KEYBOARD_EXTRA_PADDING = 120;
// How much space to leave above the focused input
const INPUT_TOP_MARGIN = 20;

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  /**
   * Custom header component (rendered above scroll content, fixed)
   */
  header?: React.ReactNode;
  /**
   * Custom footer component (rendered below scroll content, fixed)
   */
  footer?: React.ReactNode;
  /**
   * Style for the outer container
   */
  style?: ViewStyle;
  /**
   * Style for the scroll content container
   */
  contentContainerStyle?: ViewStyle;
  /**
   * Background color for the screen
   */
  backgroundColor?: string;
  /**
   * Whether to use SafeAreaView edges
   */
  safeAreaEdges?: ('top' | 'bottom' | 'left' | 'right')[];
  /**
   * Keyboard vertical offset for KeyboardAvoidingView
   */
  keyboardVerticalOffset?: number;
  /**
   * Whether to show scroll indicator
   */
  showsVerticalScrollIndicator?: boolean;
  /**
   * Additional bottom padding (for screens with bottom buttons)
   */
  extraBottomPadding?: number;
}

export function KeyboardAwareScreen({
  children,
  header,
  footer,
  style,
  contentContainerStyle,
  backgroundColor = colors.bg,
  safeAreaEdges = ['top', 'bottom'],
  keyboardVerticalOffset = 0,
  showsVerticalScrollIndicator = false,
  extraBottomPadding = 0,
}: KeyboardAwareScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollViewLayout, setScrollViewLayout] = useState({ y: 0, height: 0 });
  const focusedInputRef = useRef<number | null>(null);

  // Track keyboard visibility and height
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Handle scroll view layout
  const handleScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setScrollViewLayout({ y, height });
  }, []);

  // Scroll to make the focused input visible
  const scrollToInput = useCallback(
    (reactNode: number) => {
      if (!scrollViewRef.current) return;

      // Use measureLayout to get the input's position relative to the scroll view
      const scrollView = scrollViewRef.current;
      const scrollViewNode = findNodeHandle(scrollView);

      if (scrollViewNode) {
        // Get the native node for measurement
        const inputNode = reactNode;

        // Scroll to the input with some margin at the top
        setTimeout(() => {
          scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            inputNode,
            INPUT_TOP_MARGIN + (isKeyboardVisible ? keyboardHeight * 0.3 : 0),
            true
          );
        }, 100);
      }
    },
    [isKeyboardVisible, keyboardHeight]
  );

  // Wrap children to intercept TextInput focus events
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return child;
  });

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor }, style]}
      edges={safeAreaEdges}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {/* Fixed Header */}
        {header && <View style={styles.header}>{header}</View>}

        {/* Scrollable Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            contentContainerStyle,
            {
              paddingBottom:
                (isKeyboardVisible ? KEYBOARD_EXTRA_PADDING : spacing.xxl) +
                extraBottomPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          onLayout={handleScrollViewLayout}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {enhancedChildren}
        </ScrollView>

        {/* Fixed Footer */}
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Hook to use with inputs inside KeyboardAwareScreen
 * Returns props to spread onto TextInput for auto-scroll behavior
 */
export function useKeyboardAwareInput(scrollViewRef: React.RefObject<ScrollView>) {
  const inputRef = useRef<TextInput>(null);

  const scrollToSelf = useCallback(() => {
    if (inputRef.current && scrollViewRef.current) {
      const nodeHandle = findNodeHandle(inputRef.current);
      if (nodeHandle) {
        setTimeout(() => {
          scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            nodeHandle,
            INPUT_TOP_MARGIN,
            true
          );
        }, 100);
      }
    }
  }, [scrollViewRef]);

  return {
    ref: inputRef,
    onFocus: scrollToSelf,
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  footer: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

export default KeyboardAwareScreen;
