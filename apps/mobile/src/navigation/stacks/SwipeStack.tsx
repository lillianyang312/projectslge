import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../types';

// Import screens
import SwipeScreen from '../../screens/SwipeScreen';
import ItemDetailScreen from '../../screens/ItemDetailScreen';

const Stack = createNativeStackNavigator<SwipeStackParamList>();

export default function SwipeStack() {
  return (
    <Stack.Navigator
      id="swipe"
      initialRouteName="Swipe"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="Swipe" component={SwipeScreen} options={{ title: 'Swipe' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item Detail' }} />
    </Stack.Navigator>
  );
}
