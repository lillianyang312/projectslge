import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';

// Import screens
import WelcomeScreen from '../screens/auth/Welcome';
import LoginScreen from '../screens/auth/Login';
import SignupStep1Screen from '../screens/auth/SignupStep1';
import SignupStep2Screen from '../screens/auth/SignupStep2';
import VerifyEmailScreen from '../screens/auth/VerifyEmail';
// Legacy screens (kept for compatibility)
import AuthScreen from '../screens/auth/Auth';
import ForgotPasswordScreen from '../screens/auth/ForgotPassword';
import ResetPasswordScreen from '../screens/auth/ResetPassword';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      id="auth"
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignupStep1" component={SignupStep1Screen} />
      <Stack.Screen name="SignupStep2" component={SignupStep2Screen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      {/* Legacy screens */}
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
