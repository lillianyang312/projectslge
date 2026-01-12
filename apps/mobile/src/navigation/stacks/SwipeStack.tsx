import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../types';

// Import screens
import SwipeMainScreen from '../../screens/swipe/SwipeMain';

const Stack = createNativeStackNavigator<SwipeStackParamList>();

export default function SwipeStack() {
  return (
    <Stack.Navigator
      id="swipe"
      initialRouteName="SwipeMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="SwipeMain" component={SwipeMainScreen} />
    </Stack.Navigator>
  );
}
