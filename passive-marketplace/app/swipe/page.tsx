'use client'

import { useState, useEffect } from 'react'
import { getNeighborhoodItems, getProfile, saveSwipeAction, generateId, getItems } from '@/lib/store'
import type { SwipeActionType, RejectReason, NeighborhoodItem } from '@/lib/types'

const rejectReasons: RejectReason[] = ['too expensive', 'wrong condition', 'too far', 'shipping not ok', 'not what I meant']

export default function SwipePage() {
  const [mode, setMode] = useState<'buying' | 'selling'>('buying')
  const [deck, setDeck] = useState<NeighborhoodItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showRejectReasons, setShowRejectReasons] = useState(false)
  const [profile, setProfile] = useState(getProfile())

  useEffect(() => {
    setProfile(getProfile())
  }, [])

  useEffect(() => {
    if (mode === 'buying') {
      setDeck(getNeighborhoodItems())
      setCurrentIndex(0)
      setShowRejectReasons(false)
    } else {
      const myItems = getItems()
      setDeck(myItems as any)
      setCurrentIndex(0)
      setShowRejectReasons(false)
    }
  }, [mode])

  const handleSwipe = (action: SwipeActionType, reason?: RejectReason) => {
    if (!profile) return

    const current = deck[currentIndex]
    if (!current) return

    saveSwipeAction({
      id: generateId(),
      userId: profile.userId,
      targetId: current.id,
      targetType: 'item',
      action,
      rejectReason: reason,
      createdAt: Date.now(),
    })

    if (action === 'reject' && !reason) {
      setShowRejectReasons(true)
      return
    }

    setShowRejectReasons(false)
    setCurrentIndex(currentIndex + 1)
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Please set up your profile first</p>
        <a href="/profile" className="text-foreground underline">Go to Profile</a>
      </div>
    )
  }

  const current = deck[currentIndex]

  if (!current) {
    return (
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <div className="p-4 border-b border-border flex gap-4 justify-center">
          <button
            onClick={() => setMode('buying')}
            className={`px-4 py-2 rounded ${mode === 'buying' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
          >
            Buying
          </button>
          <button
            onClick={() => setMode('selling')}
            className={`px-4 py-2 rounded ${mode === 'selling' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
          >
            Selling
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No more items to swipe</p>
            <button
              onClick={() => {
                setCurrentIndex(0)
                setMode(mode === 'buying' ? 'selling' : 'buying')
              }}
              className="px-4 py-2 border border-border rounded hover:bg-secondary"
            >
              Switch mode
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col">
      <div className="p-4 border-b border-border flex gap-4 justify-center">
        <button
          onClick={() => setMode('buying')}
          className={`px-4 py-2 rounded transition-colors ${
            mode === 'buying' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Buying
        </button>
        <button
          onClick={() => setMode('selling')}
          className={`px-4 py-2 rounded transition-colors ${
            mode === 'selling' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Selling
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="border border-border rounded-lg p-6 mb-4 bg-background shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-medium text-foreground mb-2">{current.name}</h2>
              {current.category && (
                <p className="text-sm text-muted-foreground mb-1">{current.category}</p>
              )}
              {current.condition && (
                <p className="text-sm text-muted-foreground mb-1">Condition: {current.condition}</p>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {current.wouldLetGoFor && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium text-foreground">${current.wouldLetGoFor}</span>
                </div>
              )}
              {current.estimatedValue && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. value:</span>
                  <span className="text-muted-foreground">${current.estimatedValue}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-4">
              <span className="text-xs px-2 py-1 bg-secondary text-foreground rounded capitalize">
                {current.shippingPreference}
              </span>
              <span className="text-xs px-2 py-1 bg-secondary text-foreground rounded capitalize">
                {current.likelihoodToSell}
              </span>
              {current.isSpecialCollectible && (
                <span className="text-xs px-2 py-1 bg-foreground text-background rounded">
                  Collectible
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              {currentIndex + 1} of {deck.length}
            </p>

            {!showRejectReasons ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSwipe('reject')}
                  className="flex-1 py-3 border border-border rounded hover:bg-secondary transition-colors text-2xl"
                  title="Not interested"
                >
                  ❌
                </button>
                <button
                  onClick={() => handleSwipe('save')}
                  className="flex-1 py-3 border border-border rounded hover:bg-secondary transition-colors text-2xl"
                  title="Save for later"
                >
                  ➡️
                </button>
                <button
                  onClick={() => handleSwipe('interested')}
                  className="flex-1 py-3 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors text-2xl"
                  title="Interested"
                >
                  ✅
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Why not interested?</p>
                {rejectReasons.map(r => (
                  <button
                    key={r}
                    onClick={() => handleSwipe('reject', r)}
                    className="w-full py-2 border border-border rounded hover:bg-secondary transition-colors text-sm text-left px-3"
                  >
                    {r}
                  </button>
                ))}
                <button
                  onClick={() => setShowRejectReasons(false)}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
