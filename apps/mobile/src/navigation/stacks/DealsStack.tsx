import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../types';
import { useRoute, RouteProp } from '@react-navigation/native';
import { AppTabsParamList } from '../types';

// Import screens
import DealsHomeScreen from '../../screens/deals/DealsHome';
import DealDetailScreen from '../../screens/deals/DealDetail';
import OfferScreen from '../../screens/deals/Offer';
import DealChatScreen from '../../screens/deals/DealChat';
import UserProfileScreen from '../../screens/deals/UserProfile';
import PickupDetailsScreen from '../../screens/logistics/PickupDetails';
import ShippingScreen from '../../screens/logistics/Shipping';
import ConversationsListScreen from '../../screens/chat/ConversationsList';
import ChatThreadScreen from '../../screens/inbox/ChatThread';

const Stack = createNativeStackNavigator<DealsStackParamList>();

type DealsTabRouteProp = RouteProp<AppTabsParamList, 'Deals'>;

export default function DealsStack() {
  const tabRoute = useRoute<DealsTabRouteProp>();
  const initialMode = tabRoute.params?.initialMode;

  return (
    <Stack.Navigator
      id="deals"
      initialRouteName="DealsHome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="DealsHome"
        component={DealsHomeScreen}
        initialParams={{ initialMode }}
      />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} />
      <Stack.Screen name="Offer" component={OfferScreen} />
      <Stack.Screen name="DealChat" component={DealChatScreen} />
      <Stack.Screen name="Profile" component={UserProfileScreen} />
      <Stack.Screen name="PickupDetails" component={PickupDetailsScreen} />
      <Stack.Screen name="Shipping" component={ShippingScreen} />
      <Stack.Screen name="Conversations" component={ConversationsListScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
    </Stack.Navigator>
  );
}
