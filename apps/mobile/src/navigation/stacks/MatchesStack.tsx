import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MatchesStackParamList } from '../types';

// Import screens
import MatchesHomeScreen from '../../screens/matches/MatchesHome';

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export default function MatchesStack() {
  return (
    <Stack.Navigator
      id="matches"
      initialRouteName="MatchesHome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MatchesHome" component={MatchesHomeScreen} />
      {/* TODO: Add MatchDetail screen */}
    </Stack.Navigator>
  );
}
