import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../types';

// Import screens
import SwipeBuyScreen from '../../screens/swipe/SwipeBuy';
import SwipeSellScreen from '../../screens/swipe/SwipeSell';

const Stack = createNativeStackNavigator<SwipeStackParamList>();

export default function SwipeStack() {
  return (
    <Stack.Navigator
      id="swipe"
      initialRouteName="SwipeBuy"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="SwipeBuy" component={SwipeBuyScreen} />
      <Stack.Screen name="SwipeSell" component={SwipeSellScreen} />
    </Stack.Navigator>
  );
}
