'use client'

import { useState, useEffect } from 'react'
import type { Match, Item, Want } from '@/lib/types'
import {
  getMatches,
  saveMatch,
  markMatchAsSeen,
  getItems,
  getWants,
  getProfile,
  getNeighborhoodItems,
  getNeighborhoodWants,
  getNeighborhoodUsers,
  getOffers,
  saveOffer,
  markOfferAsSpam,
  generateId,
} from '@/lib/store'
import {
  findMatchesForUserWants,
  findMatchesForUserItems,
} from '@/lib/matching'
import MatchCard from '@/components/MatchCard'
import AgentPanel from '@/components/AgentPanel'
import OfferModal from '@/components/OfferModal'

type EnrichedMatch = Match & {
  itemName: string
  wantName: string
  buyerMax?: number
  sellerAsk?: number
  estimatedValue?: number
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [wantMatches, setWantMatches] = useState<EnrichedMatch[]>([])
  const [sellMatches, setSellMatches] = useState<EnrichedMatch[]>([])
  const [activeAgentMatch, setActiveAgentMatch] = useState<Match | null>(null)
  const [activeOfferMatch, setActiveOfferMatch] = useState<EnrichedMatch | null>(null)
  const [profile, setProfile] = useState(getProfile())

  const loadMatches = () => {
    if (!profile) return

    const existingMatches = getMatches()
    const items = getItems()
    const wants = getWants()
    const neighborhoodItems = getNeighborhoodItems()
    const neighborhoodWants = getNeighborhoodWants()
    const neighborhoodUsers = getNeighborhoodUsers()

    const newWantMatches = findMatchesForUserWants(
      wants,
      neighborhoodItems,
      neighborhoodUsers,
      profile,
      existingMatches
    )

    const newSellMatches = findMatchesForUserItems(
      items,
      neighborhoodWants,
      neighborhoodUsers,
      profile,
      existingMatches
    )

    newWantMatches.forEach(m => saveMatch(m))
    newSellMatches.forEach(m => saveMatch(m))

    const allMatches = getMatches()

    const enriched = allMatches.map(match => {
      const item =
        items.find(i => i.id === match.itemId) ||
        neighborhoodItems.find(i => i.id === match.itemId)
      const want =
        wants.find(w => w.id === match.wantId) ||
        neighborhoodWants.find(w => w.id === match.wantId)

      return {
        ...match,
        itemName: item?.name || 'Unknown',
        wantName: want?.name || 'Unknown',
        buyerMax: want?.maxOffer,
        sellerAsk: item?.wouldLetGoFor,
        estimatedValue: 'estimatedValue' in (item || {}) ? (item as Item).estimatedValue : undefined,
      }
    })

    const wants_ = enriched.filter(m => m.buyerId === profile.userId)
    const sells = enriched.filter(m => m.sellerId === profile.userId)

    setMatches(enriched)
    setWantMatches(wants_)
    setSellMatches(sells)
  }

  useEffect(() => {
    setProfile(getProfile())
  }, [])

  useEffect(() => {
    loadMatches()
  }, [profile])

  const handleRequestAgent = (match: Match) => {
    markMatchAsSeen(match.id)
    setActiveAgentMatch(match)
  }

  const handleAgentCoordinate = (
    method: 'pickup' | 'ship',
    payment: 'venmo' | 'cash' | 'other'
  ) => {
    if (!activeAgentMatch) return

    const updated: Match = {
      ...activeAgentMatch,
      agentRequested: true,
      coordinationMethod: method,
      paymentMethod: payment,
      groupTextStarted: true,
    }

    saveMatch(updated)
    setActiveAgentMatch(null)
    loadMatches()
  }

  const handleMakeOffer = (match: EnrichedMatch) => {
    markMatchAsSeen(match.id)
    setActiveOfferMatch(match)
  }

  const handleSubmitOffer = (amount: number) => {
    if (!activeOfferMatch || !profile) return

    const existingOffer = getOffers().find(
      o => o.wantId === activeOfferMatch.wantId && o.itemId === activeOfferMatch.itemId && o.buyerId === profile.userId
    )

    if (existingOffer) {
      existingOffer.amount = amount
      saveOffer(existingOffer)
    } else {
      saveOffer({
        id: generateId(),
        wantId: activeOfferMatch.wantId,
        itemId: activeOfferMatch.itemId,
        buyerId: profile.userId,
        sellerId: activeOfferMatch.sellerId,
        amount,
        status: 'pending',
        createdAt: Date.now(),
      })
    }

    setActiveOfferMatch(null)
    alert('Offer submitted!')
  }

  const handleIncrementOffer = (increment: number) => {
    if (!activeOfferMatch || !profile) return

    const existingOffer = getOffers().find(
      o => o.wantId === activeOfferMatch.wantId && o.itemId === activeOfferMatch.itemId && o.buyerId === profile.userId
    )

    if (existingOffer) {
      existingOffer.amount += increment
      saveOffer(existingOffer)
      alert(`Offer increased by $${increment}`)
    }
  }

  const handleReportSpam = (match: EnrichedMatch) => {
    if (confirm('Report this match as spam?')) {
      const offers = getOffers().filter(
        o => o.wantId === match.wantId && o.itemId === match.itemId
      )
      offers.forEach(o => markOfferAsSpam(o.id))
      alert('Reported as spam. Thank you.')
    }
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
          <h1 className="text-xl font-medium text-foreground">Matches</h1>
        </div>
        <div className="px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">
            Set up your profile first to see matches
          </p>
          <a
            href="/profile"
            className="px-6 py-2 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium inline-block"
          >
            Go to Profile
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
        <h1 className="text-xl font-medium text-foreground">Matches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {matches.filter(m => !m.seen).length} new
        </p>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          You want something someone has
        </h2>
        {wantMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-6">
            No matches yet. Add wants to see matches.
          </p>
        ) : (
          <div className="mb-6">
            {wantMatches.map(match => (
              <div key={match.id} className="relative">
                <MatchCard
                  match={match}
                  direction="want"
                  onRequestAgent={() => handleRequestAgent(match)}
                />
                {!match.agentRequested && (
                  <div className="flex gap-2 px-4 pb-3">
                    <button
                      onClick={() => handleMakeOffer(match)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Make offer
                    </button>
                    <button
                      onClick={() => handleReportSpam(match)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Report spam
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Someone wants something you listed
        </h2>
        {sellMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches yet. Add items to see matches.
          </p>
        ) : (
          <div>
            {sellMatches.map(match => (
              <div key={match.id} className="relative">
                <MatchCard
                  match={match}
                  direction="sell"
                  onRequestAgent={() => handleRequestAgent(match)}
                />
                {!match.agentRequested && (
                  <div className="flex gap-2 px-4 pb-3">
                    <button
                      onClick={() => handleReportSpam(match)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Report spam
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeAgentMatch && (
        <AgentPanel
          onCoordinate={handleAgentCoordinate}
          onClose={() => setActiveAgentMatch(null)}
        />
      )}

      {activeOfferMatch && (
        <OfferModal
          itemName={activeOfferMatch.itemName}
          sellerAsk={activeOfferMatch.sellerAsk}
          currentOffer={
            getOffers().find(
              o =>
                o.wantId === activeOfferMatch.wantId &&
                o.itemId === activeOfferMatch.itemId &&
                o.buyerId === profile.userId
            )?.amount
          }
          onSubmit={handleSubmitOffer}
          onIncrement={handleIncrementOffer}
          onClose={() => setActiveOfferMatch(null)}
        />
      )}
    </div>
  )
}
