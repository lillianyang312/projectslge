import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../types';

// Import screens
import UploadScreen from '../../screens/upload/Upload';
import ConfirmAddToListScreen from '../../screens/upload/ConfirmAddToList';

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
      <Stack.Screen name="ConfirmAddToList" component={ConfirmAddToListScreen} />
    </Stack.Navigator>
  );
}
