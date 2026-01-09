import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WantsStackParamList } from '../types';

// Import screens
import MyWantsScreen from '../../screens/MyWantsScreen';
import AddWantScreen from '../../screens/AddWantScreen';

const Stack = createNativeStackNavigator<WantsStackParamList>();

export default function WantsStack() {
  return (
    <Stack.Navigator
      id="wants"
      initialRouteName="MyWants"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="MyWants" component={MyWantsScreen} options={{ title: 'My Wants' }} />
      <Stack.Screen name="AddWant" component={AddWantScreen} options={{ title: 'Add Want' }} />
    </Stack.Navigator>
  );
}
