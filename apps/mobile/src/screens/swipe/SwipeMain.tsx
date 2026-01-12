import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../../navigation/types';
import { ToggleGroup, SwipeCard, Text } from '../../ui/components';
import { colors, spacing } from '../../ui/tokens';

type Props = NativeStackScreenProps<SwipeStackParamList, 'SwipeMain'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_UP_THRESHOLD = 100;
const SWIPE_OUT_DURATION = 250;

// Demo data matching the HTML exactly
const buyingCards = [
  {
    id: '1',
    emoji: '🪴',
    title: 'Monstera Plant (Large)',
    badges: [
      { label: 'Local only', variant: 'success' as const },
      { label: '~0.5 mi', variant: 'neutral' as const },
      { label: 'Like new', variant: 'neutral' as const },
    ],
    leftLabel: 'OUR TAKE',
    leftValue: 'Good deal',
    leftValueColor: colors.success,
    leftSubtext: 'Seller likely accepts $50–60',
    rightLabel: 'MARKET ESTIMATE',
    rightValue: '$70–90',
    rightSubtext: 'Asking $60',
  },
  {
    id: '2',
    emoji: '📚',
    title: 'IKEA Billy Bookshelf',
    badges: [
      { label: 'Local only', variant: 'success' as const },
      { label: '~1.2 mi', variant: 'neutral' as const },
      { label: 'Good', variant: 'neutral' as const },
    ],
    leftLabel: 'OUR TAKE',
    leftValue: 'Fair price',
    leftValueColor: colors.warning,
    leftSubtext: 'Reasonable for condition',
    rightLabel: 'MARKET ESTIMATE',
    rightValue: '$40–60',
    rightSubtext: 'Asking $45',
  },
  {
    id: '3',
    emoji: '🎧',
    title: 'Sony WH-1000XM4',
    badges: [
      { label: 'Shipping OK', variant: 'blue' as const },
      { label: 'Like new', variant: 'neutral' as const },
    ],
    leftLabel: 'OUR TAKE',
    leftValue: 'Great deal',
    leftValueColor: colors.success,
    leftSubtext: 'Below market price',
    rightLabel: 'MARKET ESTIMATE',
    rightValue: '$200–250',
    rightSubtext: 'Asking $175',
  },
];

const sellingCards = [
  {
    id: '1',
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    subtitle: 'Someone wants your item',
    badges: [
      { label: 'Local pickup', variant: 'success' as const },
      { label: '~1.2 mi', variant: 'neutral' as const },
      { label: 'If good offer', variant: 'warning' as const },
    ],
    leftLabel: 'OUR TAKE',
    leftValue: 'Sell now',
    leftValueColor: colors.success,
    leftSubtext: 'Est. drops to $500 in 3 wks',
    rightLabel: 'CURRENT MAX OFFER',
    rightValue: '$550',
    rightSubtext: 'Market est. $520–$600',
    gradientColor: colors.purpleSoft,
  },
  {
    id: '2',
    emoji: '📱',
    title: 'iPhone 14 Pro',
    subtitle: 'Someone wants your item',
    badges: [
      { label: 'Shipping OK', variant: 'blue' as const },
      { label: 'Maybe', variant: 'neutral' as const },
    ],
    leftLabel: 'OUR TAKE',
    leftValue: 'Wait',
    leftValueColor: colors.warning,
    leftSubtext: 'Price likely to stabilize',
    rightLabel: 'CURRENT MAX OFFER',
    rightValue: '$700',
    rightSubtext: 'Market est. $750–$850',
    gradientColor: colors.purpleSoft,
  },
];

export default function SwipeMainScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'selling' | 'buying'>('buying');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const position = useRef(new Animated.ValueXY()).current;
  
  const cards = mode === 'buying' ? buyingCards : sellingCards;
  const currentCard = cards[currentIndex];

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
    }).start();
  };

  const swipeCard = (direction: 'left' | 'right' | 'up') => {
    const x = direction === 'left' ? -SCREEN_WIDTH * 1.5 : direction === 'right' ? SCREEN_WIDTH * 1.5 : 0;
    const y = direction === 'up' ? -500 : 0;

    Animated.timing(position, {
      toValue: { x, y },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: false,
    }).start(() => {
      // Move to next card
      setCurrentIndex((prev) => (prev + 1) % cards.length);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right - Accept
          swipeCard('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left - Reject
          swipeCard('left');
        } else if (gesture.dy < -SWIPE_UP_THRESHOLD) {
          // Swipe up - Save
          swipeCard('up');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const handleToggle = (index: number) => {
    setMode(index === 0 ? 'selling' : 'buying');
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  };

  // Card rotation and opacity based on swipe
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const rotateAndTranslate = {
    transform: [
      { rotate },
      ...position.getTranslateTransform(),
    ],
  };

  // Overlay opacity for visual feedback
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.y.interpolate({
    inputRange: [-SWIPE_UP_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (!currentCard) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Text variant="heading" size="xxxl" style={styles.emptyIcon}>
            🎉
          </Text>
          <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
            All caught up!
          </Text>
          <Text variant="body" size="lg" color="secondary">
            Check back later for more {mode === 'buying' ? 'items' : 'offers'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <ToggleGroup
          options={['Selling', 'Buying']}
          selectedIndex={mode === 'selling' ? 0 : 1}
          onSelect={handleToggle}
        />

        <View style={styles.cardContainer}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.animatedCard, rotateAndTranslate]}
          >
            {/* Like overlay */}
            <Animated.View style={[styles.overlay, styles.overlayRight, { opacity: likeOpacity }]}>
              <Text style={styles.overlayText}>✓</Text>
            </Animated.View>

            {/* Nope overlay */}
            <Animated.View style={[styles.overlay, styles.overlayLeft, { opacity: nopeOpacity }]}>
              <Text style={styles.overlayText}>✕</Text>
            </Animated.View>

            {/* Table overlay */}
            <Animated.View style={[styles.overlay, styles.overlayTop, { opacity: saveOpacity }]}>
              <Text style={styles.overlayText}>📋</Text>
            </Animated.View>

            <SwipeCard
              emoji={currentCard.emoji}
              title={currentCard.title}
              subtitle={'subtitle' in currentCard ? currentCard.subtitle : undefined}
              badges={currentCard.badges}
              leftLabel={currentCard.leftLabel}
              leftValue={currentCard.leftValue}
              leftValueColor={currentCard.leftValueColor}
              leftSubtext={currentCard.leftSubtext}
              rightLabel={currentCard.rightLabel}
              rightValue={currentCard.rightValue}
              rightSubtext={currentCard.rightSubtext}
              gradientColor={'gradientColor' in currentCard ? currentCard.gradientColor : undefined}
            />
          </Animated.View>
        </View>

        <View style={styles.hint}>
          <Text variant="body" size="sm" color="muted" style={styles.hintText}>
            ← Swipe left to pass • Swipe up to table • Swipe right to accept →
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedCard: {
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 20,
    zIndex: 1000,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayLeft: {
    left: 20,
    backgroundColor: colors.dangerSoft,
  },
  overlayRight: {
    right: 20,
    backgroundColor: colors.successSoft,
  },
  overlayTop: {
    left: '50%',
    marginLeft: -30,
    top: -10,
    backgroundColor: colors.warningSoft,
  },
  overlayText: {
    fontSize: 28,
    fontWeight: '600',
  },
  hint: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  hintText: {
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
});
