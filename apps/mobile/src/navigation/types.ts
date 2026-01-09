/**
 * Navigation Type Definitions
 *
 * ROUTE MAP (Matching passive-shopping-ui-v2.html exactly):
 *
 * ROOT STACK:
 * - Auth: Authentication stack entry → no params
 * - App: Main app tabs entry → no params
 *
 * AUTH STACK:
 * - Welcome: Marketing/onboarding landing → no params
 * - AuthForm: Signup/login form → no params
 * - ForgotPassword: Request password reset → no params
 * - ResetPassword: Enter code/new password → no params
 *
 * APP TABS (Bottom navigation bar - 5 tabs):
 * - ListTab: My List (tab label: "List" 📦) → no params
 * - WantsTab: My Wants (tab label: "Wants" 💫) → no params
 * - SwipeTab: Swipe feed (tab label: "Swipe" 👆) → no params
 * - DealsTab: Deals overview (tab label: "Deals" 🤝) → no params
 * - ProfileTab: Profile (tab label: "Profile" 👤) → no params
 *
 * LIST TAB STACK (ListTab):
 * - MyList: User's inventory list (has + FAB for upload) → no params
 * - ItemDetail: Item details page → { itemId: string }
 * - Upload: Take/select photo (from + FAB) → no params
 * - Clarification: Clarifying questions → no params
 * - ConfirmAddToList: Confirm item details → no params
 *
 * WANTS TAB STACK (WantsTab):
 * - MyWants: User's want list (has + FAB for add) → no params
 * - AddWant: Add new want (from + FAB) → no params
 *
 * SWIPE TAB STACK (SwipeTab):
 * - Swipe: Swipe feed (buy/sell toggle) → no params
 * - ItemDetail: Item details page → { itemId: string }
 *
 * DEALS TAB STACK (DealsTab):
 * - DealsHome: Deals overview with top tabs (Active/Matches/History) + Messages button → no params
 * - DealDetail: Deal details → { dealId: string }
 * - LogisticsShipping: Pickup/shipping choices → { dealId: string }
 * - DealChat: Chat context for a deal → { dealId: string }
 * - Conversations: Chat inbox (from Messages button) → no params
 * - ChatThread: Chat with a person → { conversationId: string }
 *
 * PROFILE TAB STACK (ProfileTab):
 * - Profile: Profile settings (has Messages button) → no params
 * - Conversations: Chat inbox (from Messages button) → no params
 * - ChatThread: Chat with a person → { conversationId: string }
 */

// Root-level navigation
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

// Auth flow
export type AuthStackParamList = {
  Welcome: undefined;
  AuthForm: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

// Bottom tabs (matching UI draft exactly - 5 tabs)
export type AppTabsParamList = {
  ListTab: undefined;      // My List (shows "List" label)
  WantsTab: undefined;     // My Wants (shows "Wants" label)
  SwipeTab: undefined;     // Swipe feed
  DealsTab: undefined;     // Deals with top tabs
  ProfileTab: undefined;   // Profile
};

// List tab stack (includes upload flow from + FAB)
export type ListStackParamList = {
  MyList: undefined;
  ItemDetail: { itemId: string };
  Upload: undefined;           // From + FAB
  Clarification: undefined;
  ConfirmAddToList: undefined;
};

// Wants tab stack
export type WantsStackParamList = {
  MyWants: undefined;
  AddWant: undefined;  // From + FAB
};

// Swipe tab stack
export type SwipeStackParamList = {
  Swipe: undefined;
  ItemDetail: { itemId: string };
};

// Deals tab stack (with top material tabs + Messages button)
export type DealsStackParamList = {
  DealsHome: undefined;        // Has top tabs: Active/Matches/History
  DealDetail: { dealId: string };
  LogisticsShipping: { dealId: string };
  DealChat: { dealId: string };
  Conversations: undefined;    // Messages from top-right button
  ChatThread: { conversationId: string };
};

// Profile tab stack (with Messages button)
export type ProfileStackParamList = {
  Profile: undefined;
  Conversations: undefined;    // Messages from button
  ChatThread: { conversationId: string };
};

// Legacy type aliases for backward compatibility
export type HomeStackParamList = ListStackParamList;
export type UploadStackParamList = ListStackParamList;
export type MatchesStackParamList = DealsStackParamList;
export type ChatStackParamList = ProfileStackParamList;
