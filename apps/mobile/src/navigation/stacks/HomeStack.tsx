import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../types';

// Import screens
import MyListScreen from '../../screens/home/MyList';
import ItemDetailScreen from '../../screens/home/ItemDetail';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator
      id="home"
      initialRouteName="MyList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MyList" component={MyListScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </Stack.Navigator>
  );
}
