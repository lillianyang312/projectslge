/**
 * Navigation Type Definitions for UI v2
 *
 * SIMPLIFIED STRUCTURE:
 * Root → Auth OR App
 * Auth: Welcome → Auth (Login/Signup toggle) → ForgotPassword → ResetPassword
 * App: Tabs (Home, Upload, Swipe, Matches, Deals, Chat) - stubs for now except Home & Upload
 */

// Root-level navigation
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

// Auth flow
export type AuthStackParamList = {
  Welcome: undefined;
  Auth: undefined;           // Combined Login/Signup screen
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

// Bottom tabs - simplified structure
export type AppTabsParamList = {
  Home: undefined;
  Upload: undefined;
  Swipe: undefined;
  Matches: undefined;
  Deals: undefined;
  Chat: undefined;
};

// Home tab stack
export type HomeStackParamList = {
  MyList: undefined;
  ItemDetail: { itemId: string };
};

// List stack (includes Upload flow)
export type ListStackParamList = {
  MyList: undefined;
  ItemDetail: { itemId: string };
  Upload: undefined;
  Clarification: undefined;
  ConfirmAddToList: undefined;
};

// Upload stack (Upload → Clarification → ConfirmAddToList)
export type UploadStackParamList = {
  Upload: undefined;
  Clarification: {
    imageUri: string;
    imagePath: string;
    question: string;
    options: Array<{ id: string; label: string }>;
    originalLabel: string;
    confidence: number;
  };
  ConfirmAddToList: undefined;
};

// Swipe stack (Day 3)
export type SwipeStackParamList = {
  SwipeBuy: undefined;
  SwipeSell: undefined;
};

// Matches stack (Day 3)
export type MatchesStackParamList = {
  MatchesHome: undefined;
  MatchDetail: { matchId: string };
};

// Deals stack (Day 3)
export type DealsStackParamList = {
  DealsHome: undefined;
  DealDetail: { dealId: string };
  Offer: { dealId: string };
  DealChat: { dealId: string; deliveryMethod?: string };
  PickupDetails: { dealId: string };
  Shipping: { dealId: string };
};
