import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AppTabsParamList } from './types';

// Import stack navigators
import ListStack from './stacks/ListStack';
import WantsStack from './stacks/WantsStack';
import SwipeStack from './stacks/SwipeStack';
import DealsStack from './stacks/DealsStack';
import ProfileStack from './stacks/ProfileStack';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      id="app"
      initialRouteName="ListTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2D2A26',
        tabBarInactiveTintColor: '#9C9891',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E5E0',
          height: 84,
          paddingTop: 12,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'System',
        },
      }}
    >
      <Tab.Screen
        name="ListTab"
        component={ListStack}
        options={{
          title: 'List',
          tabBarLabel: 'List',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="WantsTab"
        component={WantsStack}
        options={{
          title: 'Wants',
          tabBarLabel: 'Wants',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>💫</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SwipeTab"
        component={SwipeStack}
        options={{
          title: 'Swipe',
          tabBarLabel: 'Swipe',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>👆</Text>
          ),
        }}
      />
      <Tab.Screen
        name="DealsTab"
        component={DealsStack}
        options={{
          title: 'Deals',
          tabBarLabel: 'Deals',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>🤝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
