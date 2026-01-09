import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AppTabsParamList } from './types';

// Import stack navigators
import HomeStack from './stacks/HomeStack';
import UploadStack from './stacks/UploadStack';
import StubScreen from '../screens/StubScreen';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      id="app"
      initialRouteName="Home"
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
        name="Home"
        component={HomeStack}
        options={{
          title: 'List',
          tabBarLabel: 'List',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadStack}
        options={{
          title: 'Wants',
          tabBarLabel: 'Wants',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>💫</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Swipe"
        options={{
          title: 'Swipe',
          tabBarLabel: 'Swipe',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>👆</Text>
          ),
        }}
      >
        {() => <StubScreen title="Swipe" subtitle="Browse nearby items" />}
      </Tab.Screen>
      <Tab.Screen
        name="Deals"
        options={{
          title: 'Deals',
          tabBarLabel: 'Deals',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>🤝</Text>
          ),
        }}
      >
        {() => <StubScreen title="Deals" subtitle="Your active transactions" />}
      </Tab.Screen>
      <Tab.Screen
        name="Chat"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18 }}>👤</Text>
          ),
        }}
      >
        {() => <StubScreen title="Profile" subtitle="Your profile settings" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
