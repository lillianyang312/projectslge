import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListStackParamList } from '../types';

// Import screens
import MyListScreen from '../../screens/MyListScreen';
import ItemDetailScreen from '../../screens/ItemDetailScreen';
import UploadScreen from '../../screens/UploadScreen';
import ClarificationScreen from '../../screens/ClarificationScreen';
import ConfirmAddToListScreen from '../../screens/ConfirmAddToListScreen';

const Stack = createNativeStackNavigator<ListStackParamList>();

export default function ListStack() {
  return (
    <Stack.Navigator
      id="list"
      initialRouteName="MyList"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="MyList" component={MyListScreen} options={{ title: 'My List' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item Detail' }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload Item' }} />
      <Stack.Screen name="Clarification" component={ClarificationScreen} options={{ title: 'Clarification' }} />
      <Stack.Screen name="ConfirmAddToList" component={ConfirmAddToListScreen} options={{ title: 'Confirm' }} />
    </Stack.Navigator>
  );
}
