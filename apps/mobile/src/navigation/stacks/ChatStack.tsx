import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../types';

// Import screens
import ConversationsScreen from '../../screens/ConversationsScreen';
import ChatThreadScreen from '../../screens/ChatThreadScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  return (
    <Stack.Navigator
      id="chat"
      initialRouteName="Conversations"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Conversations' }} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}
