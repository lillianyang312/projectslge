import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types';

// Import screens
import ProfileHomeScreen from '../../screens/profile/ProfileHome';
import ConversationsListScreen from '../../screens/chat/ConversationsList';
import ChatThreadScreen from '../../screens/chat/ChatThread';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      id="profile"
      initialRouteName="Profile"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Profile" component={ProfileHomeScreen} />
      <Stack.Screen name="Conversations" component={ConversationsListScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
    </Stack.Navigator>
  );
}
