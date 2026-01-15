import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../tokens';

interface TabsProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => (
        <Pressable
          key={tab}
          style={[styles.tab, activeTab === index && styles.tabActive]}
          onPress={() => onTabChange(index)}
        >
          <Text
            variant="bodyMedium"
            size="md"
            color={activeTab === index ? 'accent' : 'muted'}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
});
