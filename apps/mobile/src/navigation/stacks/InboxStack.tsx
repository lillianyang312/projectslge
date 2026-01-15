import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InboxStackParamList } from '../types';

// Import screens
import InboxHomeScreen from '../../screens/inbox/InboxHome';
import ChatThreadScreen from '../../screens/inbox/ChatThread';

const Stack = createNativeStackNavigator<InboxStackParamList>();

export default function InboxStack() {
  return (
    <Stack.Navigator
      id="inbox"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="InboxHome" component={InboxHomeScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
    </Stack.Navigator>
  );
}
