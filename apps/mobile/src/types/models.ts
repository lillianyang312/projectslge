/**
 * Day 3: Core data models for intelligence & market behavior
 */

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ItemUrgency = 'urgent' | 'moderate' | 'flexible';
export type DeliveryPreference = 'pickup' | 'shipping' | 'either';
export type ItemPhase = 'original' | 'draft' | 'active' | 'archived';
export type ItemIntent = 'owned' | 'wanted';

export interface MarketValue {
  min: number;
  max: number;
  confidence: number; // 0-1
}

export interface Item {
  id: string;
  owner_id: string;
  image_path: string;
  image_url?: string;
  label: string;
  title?: string;
  photos?: string[];
  confidence?: number;
  category?: string;
  description?: string;
  notes?: string;
  phase: ItemPhase;
  intent: ItemIntent;
  is_active: boolean;

  // Day 3 fields
  condition?: ItemCondition;
  urgency?: ItemUrgency;
  delivery_preference?: DeliveryPreference;
  market_value_min?: number;
  market_value_max?: number;
  market_value_confidence?: number;
  user_min_price?: number; // Seller's minimum
  user_max_price?: number; // Buyer's maximum

  created_at: string;
  updated_at: string;
}

export type MatchStatus = 'active' | 'deal' | 'archived';

export interface Match {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  want_id?: string;
  match_score: number; // 0-100
  status: MatchStatus;
  created_at: string;
  updated_at: string;

  // Populated fields (not in DB)
  item?: Item;
  buyer?: User;
  seller?: User;
}

export type DealStatus = 'pending' | 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled';
export type DeliveryMethod = 'pickup' | 'shipping';

export interface Deal {
  id: string;
  match_id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  status: DealStatus;
  current_offer?: number;
  buyer_offer?: number;
  last_offer_by?: string;
  agreed_price?: number;
  delivery_method?: DeliveryMethod;
  pickup_location?: string;
  pickup_date?: string;
  pickup_decided_at?: string; // When the pickup time was decided
  shipping_address?: string;
  tracking_number?: string;
  expires_at?: string;
  is_question?: boolean;
  interested_for?: string; // '1 week', '2 weeks', '1 month', 'Flexible'
  buyer_last_read_at?: string;
  seller_last_read_at?: string;
  created_at: string;
  updated_at: string;

  // Populated fields
  item?: Item;
  buyer?: User;
  seller?: User;
  match?: Match;
}

export type MessageType = 'text' | 'offer' | 'counter' | 'quick_action' | 'system' | 'broadcast';

export interface Message {
  id: string;
  deal_id: string;
  sender_id?: string; // null for agent messages
  is_agent: boolean;
  content: string;
  message_type: MessageType;
  metadata?: Record<string, any>;
  created_at: string;

  // Populated fields
  sender?: User;
}

export type SwipeAction = 'good_deal' | 'skip' | 'save' | 'accept' | 'decline';
export type SwipeContext = 'buy' | 'sell';

export interface SwipeActionRecord {
  id: string;
  user_id: string;
  item_id: string;
  action: SwipeAction;
  context: SwipeContext;
  created_at: string;
}

export interface User {
  id: string;
  email: string; // Internal use only - never exposed to other users
  display_name?: string;
  first_name?: string;
  neighborhood?: string; // house
  dorm_location?: string; // dorm_building + dorm_room (only shown after schedule finalized)
  graduation_year?: number;
  avatar_url?: string;
  last_seen_at?: string;
  rating?: number; // 1-5 stars average
  rating_count?: number;
  sales_completed?: number;
  purchases_completed?: number;
  created_at: string;
}

// Agent intelligence types
export interface AgentSuggestion {
  type: 'offer' | 'counter' | 'accept' | 'decline';
  amount?: number;
  reasoning: string;
  confidence: number; // 0-1
}

export interface DealEvaluation {
  is_good_deal: boolean;
  market_comparison: 'below' | 'at' | 'above'; // Compared to market value
  percentage_off?: number; // e.g., 20 for 20% off
  agent_take: string; // Agent's recommendation
  reasoning: string[];
}
