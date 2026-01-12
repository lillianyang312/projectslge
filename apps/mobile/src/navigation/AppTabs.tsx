import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AppTabsParamList } from './types';
import { colors } from '../ui/tokens';

// Import stack navigators
import HomeStack from './stacks/HomeStack';
import WantsStack from './stacks/WantsStack';
import SwipeStack from './stacks/SwipeStack';
import DealsStack from './stacks/DealsStack';
import ProfileStack from './stacks/ProfileStack';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
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
        name="Wants"
        component={WantsStack}
        options={{
          tabBarLabel: 'Wants',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>💫</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Swipe"
        component={SwipeStack}
        options={{
          tabBarLabel: 'Swipe',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>👆</Text>
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
