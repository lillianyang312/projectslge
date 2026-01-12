import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../types';

// Import screens
import DealsHomeScreen from '../../screens/deals/DealsHome';
import OfferScreen from '../../screens/deals/Offer';
import DealChatScreen from '../../screens/deals/DealChat';
import PickupDetailsScreen from '../../screens/logistics/PickupDetails';
import ShippingScreen from '../../screens/logistics/Shipping';

const Stack = createNativeStackNavigator<DealsStackParamList>();

export default function DealsStack() {
  return (
    <Stack.Navigator
      id="deals"
      initialRouteName="DealsHome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DealsHome" component={DealsHomeScreen} />
      {/* TODO: Add DealDetail screen */}
      <Stack.Screen name="Offer" component={OfferScreen} />
      <Stack.Screen name="DealChat" component={DealChatScreen} />
      <Stack.Screen name="PickupDetails" component={PickupDetailsScreen} />
      <Stack.Screen name="Shipping" component={ShippingScreen} />
    </Stack.Navigator>
  );
}
