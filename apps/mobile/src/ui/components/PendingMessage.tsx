import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../tokens';

interface PendingMessageProps {
  /**
   * Optional sender name to display (defaults to "Agent")
   */
  senderName?: string;
}

/**
 * PendingMessage component displays a loading animation (three dots)
 * to indicate that the agent is typing/responding.
 */
export function PendingMessage({ senderName = 'Agent' }: PendingMessageProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create staggered animation for three dots
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 200);
    const anim3 = createAnimation(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const opacity1 = dot1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const opacity2 = dot2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const opacity3 = dot3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <View style={styles.messageRow}>
      <View style={[styles.messageAvatar, styles.agentAvatar]}>
        <Text style={styles.avatarText}>🤖</Text>
      </View>
      <View style={[styles.messageBubble, styles.messageBubbleAgent]}>
        {senderName && (
          <Text variant="bodyMedium" size="xs" style={styles.senderName}>
            {senderName}
          </Text>
        )}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
          <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
          <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    maxWidth: '85%',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  agentAvatar: {
    backgroundColor: colors.purpleSoft,
  },
  avatarText: {
    fontSize: 14,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: 16,
    maxWidth: '100%',
  },
  messageBubbleAgent: {
    backgroundColor: colors.purpleSoft,
  },
  senderName: {
    marginBottom: spacing.xs,
    opacity: 0.7,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
});

