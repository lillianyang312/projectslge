import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../types';

// Import screens
import BrowseGridScreen from '../../screens/browse/BrowseGrid';
import BrowseItemDetailScreen from '../../screens/browse/BrowseItemDetail';
import ChatThreadScreen from '../../screens/inbox/ChatThread';

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
      <Stack.Screen name="SwipeMain" component={BrowseGridScreen} />
      <Stack.Screen name="BrowseItemDetail" component={BrowseItemDetailScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
    </Stack.Navigator>
  );
}
