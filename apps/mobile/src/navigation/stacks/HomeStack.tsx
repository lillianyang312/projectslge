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

/**
 * Home/List Stack
 * This stack includes:
 * - My List (main screen)
 * - Item Detail (edit existing items)
 * - Upload flow (accessible ONLY from FAB in My List)
 */
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
      <Stack.Screen name="Upload" component={UploadScreen} />
      <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
      <Stack.Screen name="PriceReview" component={PriceReviewScreen} />
    </Stack.Navigator>
  );
}
