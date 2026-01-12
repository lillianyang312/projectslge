import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListStackParamList } from '../types';

// Import screens
import MyListScreen from '../../screens/home/MyList';
import ItemDetailScreen from '../../screens/home/ItemDetail';
import UploadScreen from '../../screens/upload/Upload';
import ItemDetailsScreen from '../../screens/upload/ItemDetails';
import PriceReviewScreen from '../../screens/upload/PriceReview';

const Stack = createNativeStackNavigator<ListStackParamList>();

export default function ListStack() {
  return (
    <Stack.Navigator
      id="list"
      initialRouteName="MyList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MyList" component={MyListScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="Upload" component={UploadScreen} />
      <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
      <Stack.Screen name="PriceReview" component={PriceReviewScreen} />
    </Stack.Navigator>
  );
}
