import type {
  Item,
  Want,
  Offer,
  Match,
  Profile,
  NeighborhoodUser,
  NeighborhoodItem,
  NeighborhoodWant,
  BroadcastPing,
  Upload,
  SwipeAction,
  NegotiationState,
} from './types'

const STORAGE_KEYS = {
  ITEMS: 'passive_marketplace_items',
  WANTS: 'passive_marketplace_wants',
  OFFERS: 'passive_marketplace_offers',
  MATCHES: 'passive_marketplace_matches',
  PROFILE: 'passive_marketplace_profile',
  NEIGHBORHOOD_USERS: 'passive_marketplace_neighborhood_users',
  NEIGHBORHOOD_ITEMS: 'passive_marketplace_neighborhood_items',
  NEIGHBORHOOD_WANTS: 'passive_marketplace_neighborhood_wants',
  PINGS: 'passive_marketplace_pings',
  UPLOADS: 'passive_marketplace_uploads',
  SWIPE_ACTIONS: 'passive_marketplace_swipe_actions',
  NEGOTIATIONS: 'passive_marketplace_negotiations',
}

// Items
export const getItems = (): Item[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.ITEMS)
  return data ? JSON.parse(data) : []
}

export const saveItem = (item: Item): void => {
  const items = getItems()
  const index = items.findIndex(i => i.id === item.id)
  if (index >= 0) {
    items[index] = item
  } else {
    items.push(item)
  }
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items))
}

export const deleteItem = (id: string): void => {
  const items = getItems().filter(i => i.id !== id)
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items))
}

// Wants
export const getWants = (): Want[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.WANTS)
  return data ? JSON.parse(data) : []
}

export const saveWant = (want: Want): void => {
  const wants = getWants()
  const index = wants.findIndex(w => w.id === want.id)
  if (index >= 0) {
    wants[index] = want
  } else {
    wants.push(want)
  }
  localStorage.setItem(STORAGE_KEYS.WANTS, JSON.stringify(wants))
}

export const deleteWant = (id: string): void => {
  const wants = getWants().filter(w => w.id !== id)
  localStorage.setItem(STORAGE_KEYS.WANTS, JSON.stringify(wants))
}

// Offers
export const getOffers = (): Offer[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.OFFERS)
  return data ? JSON.parse(data) : []
}

export const saveOffer = (offer: Offer): void => {
  const offers = getOffers()
  const index = offers.findIndex(o => o.id === offer.id)
  if (index >= 0) {
    offers[index] = offer
  } else {
    offers.push(offer)
  }
  localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(offers))
}

export const deleteOffer = (id: string): void => {
  const offers = getOffers().filter(o => o.id !== id)
  localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(offers))
}

export const markOfferAsSpam = (id: string): void => {
  const offers = getOffers()
  const offer = offers.find(o => o.id === id)
  if (offer) {
    offer.isSpam = true
    localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(offers))
  }
}

// Matches
export const getMatches = (): Match[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.MATCHES)
  return data ? JSON.parse(data) : []
}

export const saveMatch = (match: Match): void => {
  const matches = getMatches()
  const index = matches.findIndex(m => m.id === match.id)
  if (index >= 0) {
    matches[index] = match
  } else {
    matches.push(match)
  }
  localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches))
}

export const markMatchAsSeen = (id: string): void => {
  const matches = getMatches()
  const match = matches.find(m => m.id === id)
  if (match) {
    match.seen = true
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches))
  }
}

// Profile
export const getProfile = (): Profile | null => {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(STORAGE_KEYS.PROFILE)
  return data ? JSON.parse(data) : null
}

export const saveProfile = (profile: Profile): void => {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile))
}

export const incrementPingCount = (): boolean => {
  const profile = getProfile()
  if (!profile) return false

  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000

  if (now - profile.lastPingReset > oneDayMs) {
    profile.pingsUsedToday = 0
    profile.lastPingReset = now
  }

  if (profile.pingsUsedToday >= 5) {
    return false
  }

  profile.pingsUsedToday++
  saveProfile(profile)
  return true
}

// Neighborhood Data
export const getNeighborhoodUsers = (): NeighborhoodUser[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.NEIGHBORHOOD_USERS)
  return data ? JSON.parse(data) : []
}

export const getNeighborhoodItems = (): NeighborhoodItem[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.NEIGHBORHOOD_ITEMS)
  return data ? JSON.parse(data) : []
}

export const getNeighborhoodWants = (): NeighborhoodWant[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.NEIGHBORHOOD_WANTS)
  return data ? JSON.parse(data) : []
}

export const loadDemoNeighborhoodData = (
  users: NeighborhoodUser[],
  items: NeighborhoodItem[],
  wants: NeighborhoodWant[]
): void => {
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_USERS, JSON.stringify(users))
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_ITEMS, JSON.stringify(items))
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_WANTS, JSON.stringify(wants))
}

// Pings
export const getPings = (): BroadcastPing[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.PINGS)
  return data ? JSON.parse(data) : []
}

export const savePing = (ping: BroadcastPing): void => {
  const pings = getPings()
  pings.push(ping)
  localStorage.setItem(STORAGE_KEYS.PINGS, JSON.stringify(pings))
}

export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Uploads
export const getUploads = (): Upload[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.UPLOADS)
  return data ? JSON.parse(data) : []
}

export const saveUpload = (upload: Upload): void => {
  const uploads = getUploads()
  const index = uploads.findIndex(u => u.id === upload.id)
  if (index >= 0) {
    uploads[index] = upload
  } else {
    uploads.push(upload)
  }
  localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(uploads))
}

// Swipe Actions
export const getSwipeActions = (): SwipeAction[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.SWIPE_ACTIONS)
  return data ? JSON.parse(data) : []
}

export const saveSwipeAction = (action: SwipeAction): void => {
  const actions = getSwipeActions()
  actions.push(action)
  localStorage.setItem(STORAGE_KEYS.SWIPE_ACTIONS, JSON.stringify(actions))
}

export const getUserSwipeAction = (userId: string, targetId: string): SwipeAction | undefined => {
  const actions = getSwipeActions()
  return actions.find(a => a.userId === userId && a.targetId === targetId)
}

// Negotiations
export const getNegotiations = (): NegotiationState[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.NEGOTIATIONS)
  return data ? JSON.parse(data) : []
}

export const saveNegotiation = (negotiation: NegotiationState): void => {
  const negotiations = getNegotiations()
  const index = negotiations.findIndex(n => n.matchId === negotiation.matchId)
  if (index >= 0) {
    negotiations[index] = negotiation
  } else {
    negotiations.push(negotiation)
  }
  localStorage.setItem(STORAGE_KEYS.NEGOTIATIONS, JSON.stringify(negotiations))
}

export const getNegotiationByMatch = (matchId: string): NegotiationState | undefined => {
  const negotiations = getNegotiations()
  return negotiations.find(n => n.matchId === matchId)
}

// Interest staleness check
export const checkWantStaleness = (want: Want): Want => {
  const now = Date.now()
  const daysSinceInteraction = (now - want.lastInteractionAt) / (1000 * 60 * 60 * 24)

  if (daysSinceInteraction >= 30 && !want.isStale) {
    want.isStale = true
  }

  return want
}

export const updateWantInteraction = (wantId: string): void => {
  const wants = getWants()
  const want = wants.find(w => w.id === wantId)
  if (want) {
    want.lastInteractionAt = Date.now()
    want.isStale = false
    saveWant(want)
  }
}

// Reset all demo data
export const resetDemoData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.NEIGHBORHOOD_USERS)
  localStorage.removeItem(STORAGE_KEYS.NEIGHBORHOOD_ITEMS)
  localStorage.removeItem(STORAGE_KEYS.NEIGHBORHOOD_WANTS)
  localStorage.removeItem(STORAGE_KEYS.OFFERS)
  localStorage.removeItem(STORAGE_KEYS.MATCHES)
  localStorage.removeItem(STORAGE_KEYS.NEGOTIATIONS)
}
