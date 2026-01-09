import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuthStore } from '../state/authStore';

// Import navigators
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator
 *
 * This is the single NavigationContainer for the entire app.
 * It decides between Auth flow and App tabs based on authentication state.
 */
export default function RootNavigator() {
  const isAuthed = useAuthStore((state) => state.isAuthed);

  return (
    <NavigationContainer>
      <Stack.Navigator
        id="root"
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthed ? (
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
