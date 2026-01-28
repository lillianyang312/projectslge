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
  Login: undefined;          // Email + biometric/code login
  SignupStep1: undefined;    // First name, last name, gender, phone
  SignupStep2: { firstName: string; lastName: string; gender: string; phone: string };    // Harvard email, year, house, dorm
  VerifyEmail: { email: string; signupData?: SignupData };  // Email verification code entry
  // Legacy screens (kept for compatibility)
  AuthLegacy: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

// Signup data passed between screens
export type SignupData = {
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  harvardEmail: string;
  graduationYear: string;
  house: string;
  dormBuilding: string;
  dormRoom: string;
  dormLocation: string;
  paymentPreference: string;
  zelleHandle?: string;
  venmoHandle?: string;
  loginPreference: 'email_code';
};

// Bottom tabs - matches HTML spec exactly
export type AppTabsParamList = {
  List: undefined;     // My List tab
  Wants: undefined;    // My Wants tab
  Swipe: undefined;    // Swipe tab (Buy/Sell toggle inside)
  Deals: { initialMode?: 'selling' | 'buying' } | undefined;    // Deals tab
  Inbox: undefined;    // Inbox tab
  Profile: undefined;  // Profile tab
};

// List tab stack (My List + Item Detail + Upload flow)
export type ListStackParamList = {
  MyList: undefined;
  ItemDetail: { itemId: string };
  Upload: undefined;
  ItemDetails: undefined;  // New screen for condition, intent, price, delivery, notes
  PriceReview: undefined;  // Shows estimated price and min price with add button
  ChatThread: { conversationId: string };  // Chat with buyers
  // Bulk upload screens
  ItemGrouping: undefined;  // Gradescope-style photo grouping
  ItemVerification: { itemIndex?: number };  // Per-item verification with dynamic category fields
  BulkPriceReview: { itemIndex?: number };  // Per-item price review
  BulkSummary: undefined;  // Final review before batch submission
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
  // Bulk upload screens
  ItemGrouping: undefined;
  ItemVerification: { itemIndex?: number };
  BulkPriceReview: { itemIndex?: number };
  BulkSummary: undefined;
};

// Swipe stack (single screen with internal toggle)
export type SwipeStackParamList = {
  SwipeMain: undefined;
  BrowseItemDetail: { itemId: string };  // Item detail with swipe-to-bid
  MatchDetail: { matchId: string };
  ChatThread: { conversationId: string };  // Chat with sellers
};

// Matches stack
export type MatchesStackParamList = {
  MatchesHome: undefined;
  MatchDetail: { matchId: string };
};

// Deals stack
export type DealsStackParamList = {
  DealsHome: { initialMode?: 'selling' | 'buying' } | undefined;
  DealDetail: { dealId: string };
  Offer: { dealId: string };
  DealChat: { dealId: string; deliveryMethod?: string };
  PickupDetails: { dealId: string };
  Shipping: { dealId: string };
  Conversations: undefined;
  ChatThread: { conversationId: string };
  Profile: { userId: string };  // View counterparty profile after deal acceptance
};

// Inbox stack
export type InboxStackParamList = {
  InboxHome: undefined;
  ChatThread: { conversationId: string };
  DealChat: { dealId: string };
};

// Profile stack
export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Conversations: undefined;
  ChatThread: { conversationId: string };
};

// Chat stack (legacy, used by old screens)
export type ChatStackParamList = {
  Conversations: undefined;
  ChatThread: { conversationId: string };
};
