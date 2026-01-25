import React, { useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { colors, shadows, spacing, radius } from '../tokens';

interface FABMenuItem {
  label: string;
  icon: string;
  onPress: () => void;
}

interface FABProps {
  onPress: () => void;
  icon?: string;
  menuItems?: FABMenuItem[];
}

export function FAB({ onPress, icon = '+', menuItems }: FABProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    if (menuOpen) {
      // Close menu
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setMenuOpen(false));
    } else {
      // Open menu
      setMenuOpen(true);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    if (menuItems && menuItems.length > 0) {
      toggleMenu();
    } else {
      onPress();
    }
  };

  const handleMenuItemPress = (item: FABMenuItem) => {
    // Close menu then execute
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setMenuOpen(false);
      item.onPress();
    });
  };

  const handleMainAction = () => {
    // Close menu then execute main action
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setMenuOpen(false);
      onPress();
    });
  };

  return (
    <>
      {/* Backdrop to close menu */}
      {menuOpen && (
        <Pressable style={styles.backdrop} onPress={toggleMenu} />
      )}

      {/* Scroll-up menu items */}
      {menuOpen && menuItems && (
        <View style={styles.menuContainer}>
          {/* Main action item (original FAB action) */}
          <Animated.View
            style={[
              styles.menuItem,
              {
                opacity: slideAnim,
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            <Pressable style={styles.menuItemButton} onPress={handleMainAction}>
              <View style={styles.menuItemIcon}>
                <Text style={styles.menuItemIconText}>+</Text>
              </View>
              <View style={styles.menuItemLabel}>
                <Text style={styles.menuItemLabelText}>Add items</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Additional menu items */}
          {menuItems.map((item, index) => (
            <Animated.View
              key={index}
              style={[
                styles.menuItem,
                {
                  opacity: slideAnim,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20 * (index + 2), 0],
                    }),
                  }],
                },
              ]}
            >
              <Pressable style={styles.menuItemButton} onPress={() => handleMenuItemPress(item)}>
                <View style={styles.menuItemIcon}>
                  <Text style={styles.menuItemIconText}>{item.icon}</Text>
                </View>
                <View style={styles.menuItemLabel}>
                  <Text style={styles.menuItemLabelText}>{item.label}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      {/* FAB button */}
      <Pressable style={styles.fab} onPress={handlePress}>
        <Animated.View style={{
          transform: [{
            rotate: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '45deg'],
            }),
          }],
        }}>
          <Text style={styles.icon}>{icon}</Text>
        </Animated.View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 28, // Just above tab bar, between Inbox and Profile
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: colors.accent,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    zIndex: 100,
  },
  icon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 90,
  },
  menuContainer: {
    position: 'absolute',
    bottom: 96, // Above FAB
    right: 24,
    alignItems: 'flex-end',
    zIndex: 95,
    gap: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemLabel: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  menuItemLabelText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  menuItemIconText: {
    fontSize: 20,
  },
});
