'use client'

import { useState, useEffect } from 'react'
import type { Want, Category, WantUrgency, ShippingPreference } from '@/lib/types'

interface WantModalProps {
  want?: Want
  onSave: (want: Partial<Want>) => void
  onClose: () => void
}

const categories: Category[] = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Books',
  'Kitchen',
  'Sports',
  'Collectibles',
  'Other',
]

const urgencies: WantUrgency[] = ['casual', 'interested', 'urgent']

export default function WantModal({ want, onSave, onClose }: WantModalProps) {
  const [showMore, setShowMore] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    maxOffer: '',
    urgency: 'interested' as WantUrgency,
    category: '' as Category | '',
    notes: '',
    isGeneralInterest: false,
    shippingPreference: 'shipping ok' as ShippingPreference,
    autoIncrementStep: '' as string,
  })

  useEffect(() => {
    if (want) {
      setFormData({
        name: want.name,
        maxOffer: want.maxOffer?.toString() || '',
        urgency: want.urgency,
        category: want.category || '',
        notes: want.notes || '',
        isGeneralInterest: want.isGeneralInterest,
        shippingPreference: want.shippingPreference,
        autoIncrementStep: want.autoIncrementStep?.toString() || '',
      })
      setShowMore(true)
    }
  }, [want])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSave({
      name: formData.name,
      maxOffer: formData.maxOffer ? parseFloat(formData.maxOffer) : undefined,
      urgency: formData.urgency,
      category: formData.category || undefined,
      notes: formData.notes || undefined,
      isGeneralInterest: formData.isGeneralInterest,
      shippingPreference: formData.shippingPreference,
      autoIncrementStep: formData.autoIncrementStep ? parseInt(formData.autoIncrementStep) : undefined,
      lastInteractionAt: Date.now(),
    })
  }

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-md sm:rounded-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex justify-between items-center">
            <h2 className="font-medium text-foreground">
              {want ? 'Edit Want' : 'Add Want'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                What are you looking for? *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g., MacBook Pro"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                How much likely to spend / max offer
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.maxOffer}
                onChange={e => setFormData({ ...formData, maxOffer: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                How badly do you want it?
              </label>
              <div className="flex gap-2">
                {urgencies.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFormData({ ...formData, urgency: u })}
                    className={`flex-1 py-2 px-3 rounded text-sm capitalize transition-colors ${
                      formData.urgency === u
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Shipping preference
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, shippingPreference: 'local only' })
                  }
                  className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                    formData.shippingPreference === 'local only'
                      ? 'bg-foreground text-background'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  Local only
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, shippingPreference: 'shipping ok' })
                  }
                  className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                    formData.shippingPreference === 'shipping ok'
                      ? 'bg-foreground text-background'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  Shipping OK
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="general"
                checked={formData.isGeneralInterest}
                onChange={e =>
                  setFormData({ ...formData, isGeneralInterest: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label htmlFor="general" className="text-sm text-foreground">
                I'm generally interested in this
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {showMore ? 'Less' : 'More options'}
            </button>

            {showMore && (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={e =>
                      setFormData({ ...formData, category: e.target.value as Category })
                    }
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select...</option>
                    {categories.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Auto-increment step (optional)
                  </label>
                  <select
                    value={formData.autoIncrementStep}
                    onChange={e =>
                      setFormData({ ...formData, autoIncrementStep: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">None</option>
                    <option value="5">+$5</option>
                    <option value="10">+$10</option>
                    <option value="20">+$20</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-increment your offer if outbid
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={3}
                    placeholder="Any additional details..."
                  />
                </div>
              </>
            )}
          </div>

          <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
