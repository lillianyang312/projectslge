import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types';

// Import screens
import ProfileScreen from '../../screens/ProfileScreen';
import ConversationsScreen from '../../screens/ConversationsScreen';
import ChatThreadScreen from '../../screens/ChatThreadScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      id="profile"
      initialRouteName="Profile"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}
