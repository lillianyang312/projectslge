import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import WelcomeScreen from '../screens/WelcomeScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ResetSentScreen from '../screens/ResetSentScreen';
import HomeScreen from '../screens/HomeScreen';
import UploadScreen from '../screens/UploadScreen';
import UploadClarifyScreen from '../screens/UploadClarifyScreen';
import MyListScreen from '../screens/MyListScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import MyWantsScreen from '../screens/MyWantsScreen';
import AddWantScreen from '../screens/AddWantScreen';
import SwipeBuyScreen from '../screens/SwipeBuyScreen';
import SwipeSellScreen from '../screens/SwipeSellScreen';
import MatchesScreen from '../screens/MatchesScreen';
import AgentScreen from '../screens/AgentScreen';
import OfferScreen from '../screens/OfferScreen';
import PickupDetailsScreen from '../screens/PickupDetailsScreen';
import ShippingScreen from '../screens/ShippingScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import DealsScreen from '../screens/DealsScreen';
import ProfileScreen from '../screens/ProfileScreen';

/**
 * Root navigation parameter list
 *
 * Define all route names and their params here.
 * Most screens don't require params (undefined), but you can add them as needed.
 *
 * Example with params:
 * ItemDetail: { itemId: string };
 * Chat: { conversationId: string };
 */
export type RootStackParamList = {
  Welcome: undefined;
  Signup: undefined;
  Login: undefined;
  ResetPassword: undefined;
  ResetSent: undefined;
  Home: undefined;
  Upload: undefined;
  UploadClarify: undefined;
  MyList: undefined;
  ItemDetail: undefined;
  MyWants: undefined;
  AddWant: undefined;
  SwipeBuy: undefined;
  SwipeSell: undefined;
  Matches: undefined;
  Agent: undefined;
  Offer: undefined;
  PickupDetails: undefined;
  Shipping: undefined;
  Conversations: undefined;
  Chat: undefined;
  Deals: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Main navigation component
 *
 * HOW TO ADD A NEW ROUTE:
 * 1. Create your screen component in src/screens/YourScreen.tsx
 * 2. Add the route to RootStackParamList above (with params or undefined)
 * 3. Import the screen at the top of this file
 * 4. Add a <Stack.Screen name="YourRoute" component={YourScreen} /> below
 *
 * Note: All screens have headerShown: false by default.
 * Individual screens can override this by setting options={{ headerShown: true }}
 */
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        id="root"
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ResetSent" component={ResetSentScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="UploadClarify" component={UploadClarifyScreen} />
        <Stack.Screen name="MyList" component={MyListScreen} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
        <Stack.Screen name="MyWants" component={MyWantsScreen} />
        <Stack.Screen name="AddWant" component={AddWantScreen} />
        <Stack.Screen name="SwipeBuy" component={SwipeBuyScreen} />
        <Stack.Screen name="SwipeSell" component={SwipeSellScreen} />
        <Stack.Screen name="Matches" component={MatchesScreen} />
        <Stack.Screen name="Agent" component={AgentScreen} />
        <Stack.Screen name="Offer" component={OfferScreen} />
        <Stack.Screen name="PickupDetails" component={PickupDetailsScreen} />
        <Stack.Screen name="Shipping" component={ShippingScreen} />
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Deals" component={DealsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
