'use client'

import { useState } from 'react'

interface OfferModalProps {
  itemName: string
  sellerAsk?: number
  currentOffer?: number
  onSubmit: (amount: number) => void
  onIncrement?: (increment: number) => void
  onClose: () => void
}

export default function OfferModal({
  itemName,
  sellerAsk,
  currentOffer,
  onSubmit,
  onIncrement,
  onClose,
}: OfferModalProps) {
  const [amount, setAmount] = useState(currentOffer?.toString() || sellerAsk?.toString() || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (amount) {
      onSubmit(parseFloat(amount))
    }
  }

  const handleIncrement = (increment: number) => {
    if (onIncrement) {
      onIncrement(increment)
    }
  }

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-md sm:rounded-lg">
        <div className="border-b border-border px-4 py-3 flex justify-between items-center">
          <h2 className="font-medium text-foreground">Make Offer</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Item</p>
              <p className="font-medium text-foreground">{itemName}</p>
            </div>

            {sellerAsk && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Seller asking</p>
                <p className="text-foreground">${sellerAsk}</p>
              </div>
            )}

            {currentOffer && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current offer</p>
                <p className="text-foreground">${currentOffer}</p>
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Your offer
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="0"
              />
            </div>

            {currentOffer && onIncrement && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Quick increment</p>
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleIncrement(inc)}
                      className="flex-1 py-2 px-3 rounded text-sm bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      +${inc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Note: Multiple people may be interested. Higher offers have better chances.
            </p>
          </div>

          <div className="border-t border-border px-4 py-3">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
            >
              Submit Offer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
