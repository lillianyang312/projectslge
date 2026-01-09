import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

// Import navigators
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator
 *
 * This is the single NavigationContainer for the entire app.
 * It decides between Auth flow and App tabs based on authentication state.
 *
 * TODO: Replace `isAuthed` with real auth state from Supabase:
 * - Install @supabase/supabase-js
 * - Create auth context/provider
 * - Use: const { session } = useAuth(); const isAuthed = !!session;
 */
export default function RootNavigator() {
  // MOCK: Hardcode to false for auth flow, true for app
  // Change this to test different flows
  const isAuthed = true; // Set to false to see auth flow, true to see app tabs

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
