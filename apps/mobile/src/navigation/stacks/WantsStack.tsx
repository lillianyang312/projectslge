import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WantsStackParamList } from '../types';

// Import screens
import MyWantsScreen from '../../screens/wants/MyWants';
import AddWantScreen from '../../screens/wants/AddWant';
import EditWantScreen from '../../screens/wants/EditWant';

const Stack = createNativeStackNavigator<WantsStackParamList>();

export default function WantsStack() {
  return (
    <Stack.Navigator
      id="wants"
      initialRouteName="MyWants"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MyWants" component={MyWantsScreen} />
      <Stack.Screen name="AddWant" component={AddWantScreen} />
      <Stack.Screen name="EditWant" component={EditWantScreen} />
    </Stack.Navigator>
  );
}
