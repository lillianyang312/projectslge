import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../types';

// Import screens
import MyListScreen from '../../screens/MyListScreen';
import ItemDetailScreen from '../../screens/ItemDetailScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator
      id="home"
      initialRouteName="MyList"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="MyList" component={MyListScreen} options={{ title: 'My List' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item Detail' }} />
    </Stack.Navigator>
  );
}
