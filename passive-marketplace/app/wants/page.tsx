'use client'

import { useState, useEffect } from 'react'
import type { Want } from '@/lib/types'
import {
  getWants,
  saveWant,
  deleteWant,
  getProfile,
  generateId,
  incrementPingCount,
  savePing,
  getNeighborhoodUsers,
} from '@/lib/store'
import WantRow from '@/components/WantRow'
import WantModal from '@/components/WantModal'

export default function WantsPage() {
  const [wants, setWants] = useState<Want[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingWant, setEditingWant] = useState<Want | undefined>()
  const [profile, setProfile] = useState(getProfile())

  useEffect(() => {
    setWants(getWants())
    setProfile(getProfile())
  }, [])

  const handleSave = (wantData: Partial<Want>) => {
    if (!profile) {
      alert('Please set up your profile first')
      return
    }

    const want: Want = editingWant
      ? { ...editingWant, ...wantData, lastInteractionAt: Date.now() }
      : {
          id: generateId(),
          userId: profile.userId,
          createdAt: Date.now(),
          urgency: 'interested',
          isGeneralInterest: false,
          shippingPreference: 'shipping ok',
          lastInteractionAt: Date.now(),
          ...wantData,
        } as Want

    saveWant(want)
    setWants(getWants())
    setShowModal(false)
    setEditingWant(undefined)
  }

  const handleEdit = (want: Want) => {
    setEditingWant(want)
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this want?')) {
      deleteWant(id)
      setWants(getWants())
    }
  }

  const handleAdd = () => {
    if (!profile) {
      alert('Please set up your profile first')
      return
    }
    setEditingWant(undefined)
    setShowModal(true)
  }

  const handleBroadcast = (want: Want) => {
    if (!profile) {
      alert('Please set up your profile first')
      return
    }

    if (!incrementPingCount()) {
      alert('Daily ping limit reached (5 per day). Try again tomorrow.')
      return
    }

    const neighborhoodUsers = getNeighborhoodUsers()
    neighborhoodUsers.forEach(user => {
      savePing({
        id: generateId(),
        wantId: want.id,
        senderId: profile.userId,
        recipientId: user.id,
        itemName: want.name,
        createdAt: Date.now(),
      })
    })

    alert(`Broadcast sent to ${neighborhoodUsers.length} nearby users. They'll be notified if they might have "${want.name}".`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
        <h1 className="text-xl font-medium text-foreground">My Wants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What are you looking for?
        </p>
      </div>

      {wants.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-muted-foreground mb-6">
            No wants yet. Add things you're looking for.
          </p>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Add first want
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {wants.map(want => (
              <div key={want.id}>
                <WantRow want={want} onClick={() => handleEdit(want)} />
                <div className="px-4 pb-3 border-b border-border">
                  <button
                    onClick={() => handleBroadcast(want)}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Broadcast interest to nearby users
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4">
            <button
              onClick={handleAdd}
              className="w-full py-3 border-2 border-dashed border-border rounded text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Add want
            </button>
          </div>
        </>
      )}

      {!profile && (
        <div className="fixed bottom-20 left-0 right-0 mx-4 p-4 bg-secondary border border-border rounded-lg">
          <p className="text-sm text-foreground mb-2">Set up your profile first</p>
          <a
            href="/profile"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Go to Profile
          </a>
        </div>
      )}

      <div className="p-4">
        <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Spam protection</p>
          <p>Limited to 5 broadcast pings per day</p>
        </div>
      </div>

      {showModal && (
        <WantModal
          want={editingWant}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false)
            setEditingWant(undefined)
          }}
        />
      )}
    </div>
  )
}
