import type {
  Item,
  Want,
  Match,
  NeighborhoodItem,
  NeighborhoodWant,
  CoarseProximity,
  Profile,
  NeighborhoodUser,
} from './types'
import { generateId } from './store'

const normalizeString = (str: string): string => {
  return str.toLowerCase().trim()
}

const substringMatch = (search: string, target: string): boolean => {
  const normalizedSearch = normalizeString(search)
  const normalizedTarget = normalizeString(target)
  return (
    normalizedTarget.includes(normalizedSearch) ||
    normalizedSearch.includes(normalizedTarget)
  )
}

const calculateProximity = (
  userProfile: Profile,
  otherUser: NeighborhoodUser
): CoarseProximity => {
  if (userProfile.locationKey === 'campus' && otherUser.locationKey === 'campus') {
    if (userProfile.locationValue === otherUser.locationValue) {
      return 'same campus zone'
    }
    return 'within ~1 mile'
  }

  if (
    userProfile.locationKey === 'neighborhood' &&
    otherUser.locationKey === 'neighborhood'
  ) {
    if (userProfile.locationValue === otherUser.locationValue) {
      return 'same neighborhood'
    }
    return 'within ~1 mile'
  }

  if (userProfile.locationKey === 'zip' && otherUser.locationKey === 'zip') {
    if (userProfile.locationValue === otherUser.locationValue) {
      return 'within ~0.5 miles'
    }
    return 'within ~3 miles'
  }

  return 'within ~3 miles'
}

const checkShippingCompatibility = (
  itemPref: string,
  wantPref: string
): boolean => {
  if (itemPref === 'shipping ok' && wantPref === 'shipping ok') return true
  if (itemPref === 'local only' && wantPref === 'local only') return true
  if (itemPref === 'shipping ok' && wantPref === 'local only') return true
  return false
}

const calculateMatchScore = (
  want: Want | NeighborhoodWant,
  item: Item | NeighborhoodItem
): number => {
  let score = 0

  if (!checkShippingCompatibility(item.shippingPreference, want.shippingPreference)) {
    return 0
  }

  if (substringMatch(want.name, item.name)) {
    score += 50
  }

  if (want.category && item.category && want.category === item.category) {
    score += 20
  }

  if (want.maxOffer && item.wouldLetGoFor) {
    if (want.maxOffer >= item.wouldLetGoFor) {
      score += 30
    } else {
      score -= 10
    }
  }

  if ('urgency' in want) {
    if (want.urgency === 'urgent') score += 10
    if (want.urgency === 'interested') score += 5
  }

  if ('likelihoodToSell' in item) {
    if (item.likelihoodToSell === 'want gone') score += 15
    if (item.likelihoodToSell === 'if good offer') score += 5
  }

  if ('lastInteractionAt' in want) {
    const daysSinceInteraction = (Date.now() - want.lastInteractionAt) / (1000 * 60 * 60 * 24)
    if (daysSinceInteraction > 14) {
      score -= 20
    } else if (daysSinceInteraction > 7) {
      score -= 10
    }
  }

  return score
}

export const findMatchesForUserWants = (
  userWants: Want[],
  neighborhoodItems: NeighborhoodItem[],
  neighborhoodUsers: NeighborhoodUser[],
  userProfile: Profile,
  existingMatches: Match[]
): Match[] => {
  const newMatches: Match[] = []

  for (const want of userWants) {
    for (const item of neighborhoodItems) {
      const alreadyMatched = existingMatches.some(
        m => m.wantId === want.id && m.itemId === item.id
      )
      if (alreadyMatched) continue

      const score = calculateMatchScore(want, item)
      if (score < 40) continue

      const itemOwner = neighborhoodUsers.find(u => u.id === item.userId)
      if (!itemOwner) continue

      const proximity = calculateProximity(userProfile, itemOwner)

      const match: Match = {
        id: generateId(),
        itemId: item.id,
        wantId: want.id,
        sellerId: item.userId,
        buyerId: userProfile.userId,
        proximity,
        score,
        seen: false,
        agentRequested: false,
        groupTextStarted: false,
        createdAt: Date.now(),
      }

      newMatches.push(match)
    }
  }

  return newMatches
}

export const findMatchesForUserItems = (
  userItems: Item[],
  neighborhoodWants: NeighborhoodWant[],
  neighborhoodUsers: NeighborhoodUser[],
  userProfile: Profile,
  existingMatches: Match[]
): Match[] => {
  const newMatches: Match[] = []

  for (const item of userItems) {
    for (const want of neighborhoodWants) {
      const alreadyMatched = existingMatches.some(
        m => m.wantId === want.id && m.itemId === item.id
      )
      if (alreadyMatched) continue

      const score = calculateMatchScore(want, item)
      if (score < 40) continue

      const buyer = neighborhoodUsers.find(u => u.id === want.userId)
      if (!buyer) continue

      const proximity = calculateProximity(userProfile, buyer)

      const match: Match = {
        id: generateId(),
        itemId: item.id,
        wantId: want.id,
        sellerId: userProfile.userId,
        buyerId: want.userId,
        proximity,
        score,
        seen: false,
        agentRequested: false,
        groupTextStarted: false,
        createdAt: Date.now(),
      }

      newMatches.push(match)
    }
  }

  return newMatches
}
