export type Category =
  | 'Electronics'
  | 'Furniture'
  | 'Clothing'
  | 'Books'
  | 'Kitchen'
  | 'Sports'
  | 'Collectibles'
  | 'Other'

export type Condition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor'

export type LikelihoodToSell = 'maybe' | 'if good offer' | 'want gone'

export type WantUrgency = 'casual' | 'interested' | 'urgent'

export type LocationKey = 'campus' | 'neighborhood' | 'zip'

export type CoarseProximity = 'within ~0.5 miles' | 'within ~1 mile' | 'within ~3 miles' | 'same campus zone' | 'same neighborhood'

export type ShippingPreference = 'local only' | 'shipping ok'

export type SwipeActionType = 'interested' | 'save' | 'reject'

export type RejectReason = 'too expensive' | 'wrong condition' | 'too far' | 'shipping not ok' | 'not what I meant'

export interface Item {
  id: string
  userId: string
  name: string
  category?: Category
  condition?: Condition
  howMuchPaid?: number
  estimatedValue?: number
  wouldLetGoFor?: number
  wouldLetGoForUnsure: boolean
  likelihoodToSell: LikelihoodToSell
  notes?: string
  isSpecialCollectible: boolean
  shippingPreference: ShippingPreference
  imageUrl?: string
  createdAt: number
}

export interface Want {
  id: string
  userId: string
  name: string
  maxOffer?: number
  urgency: WantUrgency
  category?: Category
  notes?: string
  isGeneralInterest: boolean
  shippingPreference: ShippingPreference
  autoIncrementStep?: number
  createdAt: number
  lastInteractionAt: number
  isStale?: boolean
}

export interface Offer {
  id: string
  wantId: string
  itemId: string
  buyerId: string
  sellerId: string
  amount: number
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'outbid'
  acceptedAt?: number
  createdAt: number
  isSpam?: boolean
}

export interface Match {
  id: string
  itemId: string
  wantId: string
  sellerId: string
  buyerId: string
  proximity: CoarseProximity
  score: number
  seen: boolean
  agentRequested: boolean
  coordinationMethod?: 'pickup' | 'ship'
  paymentMethod?: 'venmo' | 'cash' | 'other'
  groupTextStarted: boolean
  createdAt: number
  suppressedUntil?: number
}

export interface Profile {
  userId: string
  name: string
  ageRange?: '18-24' | '25-34' | '35-44' | '45-54' | '55+'
  locationKey: LocationKey
  locationValue: string
  pickupAvailability?: string
  verifiedEmail: boolean
  pingsUsedToday: number
  lastPingReset: number
}

export interface NeighborhoodUser {
  id: string
  name: string
  locationKey: LocationKey
  locationValue: string
}

export interface NeighborhoodItem {
  id: string
  userId: string
  name: string
  category?: Category
  condition?: Condition
  wouldLetGoFor?: number
  estimatedValue?: number
  likelihoodToSell: LikelihoodToSell
  shippingPreference: ShippingPreference
  isSpecialCollectible?: boolean
}

export interface NeighborhoodWant {
  id: string
  userId: string
  name: string
  maxOffer?: number
  urgency: WantUrgency
  category?: Category
  shippingPreference: ShippingPreference
}

export interface BroadcastPing {
  id: string
  wantId: string
  senderId: string
  recipientId: string
  itemName: string
  createdAt: number
}

export interface Upload {
  id: string
  userId: string
  imageUrl: string
  detectedTitle: string
  detectedCategory?: Category
  userEditedTitle?: string
  userEditedCategory?: Category
  createdAt: number
  addedToListOrWant?: 'list' | 'want'
}

export interface SwipeAction {
  id: string
  userId: string
  targetId: string
  targetType: 'item' | 'want'
  action: SwipeActionType
  rejectReason?: RejectReason
  createdAt: number
}

export interface NegotiationState {
  matchId: string
  buyerId: string
  sellerId: string
  currentBuyerOffer?: number
  buyerMax?: number
  autoIncrementStep?: number
  sellerAsk?: number
  agentSuggestion?: number
  lastOutbidNotice?: number
  createdAt: number
  updatedAt: number
}
