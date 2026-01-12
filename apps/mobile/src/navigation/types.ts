/**
 * Navigation Type Definitions for UI v2
 *
 * STRUCTURE:
 * Root → Auth OR App
 * Auth: Welcome → Auth (Login/Signup toggle) → ForgotPassword → ResetPassword
 * App: Tabs (List, Wants, Swipe, Deals, Profile)
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

// Bottom tabs - matches HTML spec exactly
export type AppTabsParamList = {
  List: undefined;     // My List tab
  Wants: undefined;    // My Wants tab
  Swipe: undefined;    // Swipe tab (Buy/Sell toggle inside)
  Deals: undefined;    // Deals tab
  Profile: undefined;  // Profile tab
};

// List tab stack (My List + Item Detail + Upload flow)
export type ListStackParamList = {
  MyList: undefined;
  ItemDetail: { itemId: string };
  Upload: undefined;
  ItemDetails: undefined;  // New screen for condition, intent, price, delivery, notes
  PriceReview: undefined;  // Shows estimated price and min price with add button
};

// Home tab stack (alias for backward compatibility)
export type HomeStackParamList = ListStackParamList;

// Wants tab stack
export type WantsStackParamList = {
  MyWants: undefined;
  AddWant: undefined;
  EditWant: { wantId: string };
};

// Upload stack (for upload flow within List)
export type UploadStackParamList = {
  Upload: undefined;
  ItemDetails: undefined;  // New screen for condition, intent, price, delivery, notes
  PriceReview: undefined;  // Shows estimated price and min price with add button
};

// Swipe stack (single screen with internal toggle)
export type SwipeStackParamList = {
  SwipeMain: undefined;
  MatchDetail: { matchId: string };
};

// Matches stack
export type MatchesStackParamList = {
  MatchesHome: undefined;
  MatchDetail: { matchId: string };
};

// Deals stack
export type DealsStackParamList = {
  DealsHome: undefined;
  DealDetail: { dealId: string };
  Offer: { dealId: string };
  DealChat: { dealId: string; deliveryMethod?: string };
  PickupDetails: { dealId: string };
  Shipping: { dealId: string };
  Conversations: undefined;
  ChatThread: { conversationId: string };
};

// Profile stack
export type ProfileStackParamList = {
  Profile: undefined;
  Conversations: undefined;
  ChatThread: { conversationId: string };
};

// Chat stack (legacy, used by old screens)
export type ChatStackParamList = {
  Conversations: undefined;
  ChatThread: { conversationId: string };
};
