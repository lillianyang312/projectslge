import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MatchesStackParamList } from '../types';

// Import screens
import MatchesHomeScreen from '../../screens/MatchesHomeScreen';
import MatchDetailScreen from '../../screens/MatchDetailScreen';

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export default function MatchesStack() {
  return (
    <Stack.Navigator
      id="matches"
      initialRouteName="MatchesHome"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="MatchesHome" component={MatchesHomeScreen} options={{ title: 'Matches' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Match Detail' }} />
    </Stack.Navigator>
  );
}
