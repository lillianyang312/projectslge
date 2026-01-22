import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../types';

// Import screens
import UploadScreen from '../../screens/upload/Upload';
import ItemDetailsScreen from '../../screens/upload/ItemDetails';
import PriceReviewScreen from '../../screens/upload/PriceReview';
// Bulk upload screens
import ItemGroupingScreen from '../../screens/upload/ItemGrouping';
import ItemVerificationScreen from '../../screens/upload/ItemVerification';
import BulkPriceReviewScreen from '../../screens/upload/BulkPriceReview';
import BulkSummaryScreen from '../../screens/upload/BulkSummary';

const Stack = createNativeStackNavigator<UploadStackParamList>();

export default function UploadStack() {
  return (
    <Stack.Navigator
      id="upload"
      initialRouteName="Upload"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Upload" component={UploadScreen} />
      <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
      <Stack.Screen name="PriceReview" component={PriceReviewScreen} />
      {/* Bulk upload screens */}
      <Stack.Screen name="ItemGrouping" component={ItemGroupingScreen} />
      <Stack.Screen name="ItemVerification" component={ItemVerificationScreen} />
      <Stack.Screen name="BulkPriceReview" component={BulkPriceReviewScreen} />
      <Stack.Screen name="BulkSummary" component={BulkSummaryScreen} />
    </Stack.Navigator>
  );
}
