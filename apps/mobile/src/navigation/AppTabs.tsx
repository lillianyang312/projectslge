import React, { useEffect, useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AppTabsParamList } from './types';
import { colors } from '../ui/tokens';
import { useAuthStore } from '../state/authStore';
import { getMyDeals } from '../services/dealsService';

// Import stack navigators
import HomeStack from './stacks/HomeStack';
import WantsStack from './stacks/WantsStack';
import SwipeStack from './stacks/SwipeStack';
import DealsStack from './stacks/DealsStack';
import InboxStack from './stacks/InboxStack';
import ProfileStack from './stacks/ProfileStack';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  const user = useAuthStore((state) => state.user);
  const [inboxBadgeCount, setInboxBadgeCount] = useState<number | undefined>(undefined);

  // Load inbox badge count - deals needing response
  const loadInboxBadge = useCallback(async () => {
    if (!user?.id) {
      setInboxBadgeCount(undefined);
      return;
    }

    try {
      const deals = await getMyDeals(user.id);
      // Count deals that need response: negotiating with offer from other party
      const needsResponse = deals.filter(deal => {
        return deal.status === 'negotiating' &&
               deal.current_offer &&
               deal.last_offer_by !== user.id;
      });
      setInboxBadgeCount(needsResponse.length > 0 ? needsResponse.length : undefined);
    } catch (error) {
      console.error('Error loading inbox badge:', error);
      setInboxBadgeCount(undefined);
    }
  }, [user?.id]);

  // Load on mount and periodically refresh
  useEffect(() => {
    loadInboxBadge();
    // Refresh every 30 seconds
    const interval = setInterval(loadInboxBadge, 30000);
    return () => clearInterval(interval);
  }, [loadInboxBadge]);

  return (
    <Tab.Navigator
      id="app"
      initialRouteName="List"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 90,
          paddingTop: 12,
          paddingBottom: 30,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'DMSans_400Regular',
        },
      }}
    >
      <Tab.Screen
        name="List"
        component={HomeStack}
        options={{
          tabBarLabel: 'List',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Swipe"
        component={SwipeStack}
        options={{
          tabBarLabel: 'Browse',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>🔍</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Deals"
        component={DealsStack}
        options={{
          tabBarLabel: 'Deals',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>🤝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxStack}
        options={{
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>💬</Text>
          ),
          tabBarBadge: inboxBadgeCount,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger || '#E53935',
            fontSize: 10,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
