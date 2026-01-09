import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../types';

// Import screens
import DealsHomeScreen from '../../screens/DealsHomeScreen';
import DealDetailScreen from '../../screens/DealDetailScreen';
import LogisticsShippingScreen from '../../screens/LogisticsShippingScreen';
import DealChatScreen from '../../screens/DealChatScreen';
import ConversationsScreen from '../../screens/ConversationsScreen';
import ChatThreadScreen from '../../screens/ChatThreadScreen';

const Stack = createNativeStackNavigator<DealsStackParamList>();

export default function DealsStack() {
  return (
    <Stack.Navigator
      id="deals"
      initialRouteName="DealsHome"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="DealsHome" component={DealsHomeScreen} options={{ title: 'Deals' }} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} options={{ title: 'Deal Detail' }} />
      <Stack.Screen name="LogisticsShipping" component={LogisticsShippingScreen} options={{ title: 'Logistics' }} />
      <Stack.Screen name="DealChat" component={DealChatScreen} options={{ title: 'Deal Chat' }} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}
