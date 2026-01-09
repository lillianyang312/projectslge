import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../types';

// Import screens
import UploadScreen from '../../screens/UploadScreen';
import ClarificationScreen from '../../screens/ClarificationScreen';
import ConfirmAddToListScreen from '../../screens/ConfirmAddToListScreen';

const Stack = createNativeStackNavigator<UploadStackParamList>();

export default function UploadStack() {
  return (
    <Stack.Navigator
      id="upload"
      initialRouteName="Upload"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload Item' }} />
      <Stack.Screen name="Clarification" component={ClarificationScreen} options={{ title: 'Clarification' }} />
      <Stack.Screen name="ConfirmAddToList" component={ConfirmAddToListScreen} options={{ title: 'Confirm' }} />
    </Stack.Navigator>
  );
}
