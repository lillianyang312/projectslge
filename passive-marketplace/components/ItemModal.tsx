'use client'

import { useState, useEffect } from 'react'
import type { Item, Category, Condition, LikelihoodToSell, ShippingPreference } from '@/lib/types'

interface ItemModalProps {
  item?: Item
  onSave: (item: Partial<Item>) => void
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

const conditions: Condition[] = ['New', 'Like New', 'Good', 'Fair', 'Poor']

const likelihoods: LikelihoodToSell[] = ['maybe', 'if good offer', 'want gone']

export default function ItemModal({ item, onSave, onClose }: ItemModalProps) {
  const [showMore, setShowMore] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '' as Category | '',
    condition: '' as Condition | '',
    howMuchPaid: '',
    estimatedValue: '',
    wouldLetGoFor: '',
    wouldLetGoForUnsure: false,
    likelihoodToSell: 'if good offer' as LikelihoodToSell,
    notes: '',
    isSpecialCollectible: false,
    shippingPreference: 'local only' as ShippingPreference,
  })

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category || '',
        condition: item.condition || '',
        howMuchPaid: item.howMuchPaid?.toString() || '',
        estimatedValue: item.estimatedValue?.toString() || '',
        wouldLetGoFor: item.wouldLetGoFor?.toString() || '',
        wouldLetGoForUnsure: item.wouldLetGoForUnsure,
        likelihoodToSell: item.likelihoodToSell,
        notes: item.notes || '',
        isSpecialCollectible: item.isSpecialCollectible,
        shippingPreference: item.shippingPreference,
      })
      setShowMore(true)
    }
  }, [item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: formData.name,
      category: formData.category || undefined,
      condition: formData.condition || undefined,
      howMuchPaid: formData.howMuchPaid ? parseFloat(formData.howMuchPaid) : undefined,
      estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
      wouldLetGoFor: formData.wouldLetGoFor ? parseFloat(formData.wouldLetGoFor) : undefined,
      wouldLetGoForUnsure: formData.wouldLetGoForUnsure,
      likelihoodToSell: formData.likelihoodToSell,
      notes: formData.notes || undefined,
      isSpecialCollectible: formData.isSpecialCollectible,
      shippingPreference: formData.shippingPreference,
    })
  }

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-md sm:rounded-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex justify-between items-center">
            <h2 className="font-medium text-foreground">
              {item ? 'Edit Item' : 'Add Item'}
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
                Item name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g., iPhone 12"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Likelihood to sell
              </label>
              <div className="flex gap-2">
                {likelihoods.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, likelihoodToSell: l })
                    }
                    className={`flex-1 py-2 px-3 rounded text-sm capitalize transition-colors ${
                      formData.likelihoodToSell === l
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {l}
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
                id="collectible"
                checked={formData.isSpecialCollectible}
                onChange={e =>
                  setFormData({ ...formData, isSpecialCollectible: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label htmlFor="collectible" className="text-sm text-foreground">
                This is a special collectible
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
                    Condition
                  </label>
                  <select
                    value={formData.condition}
                    onChange={e =>
                      setFormData({ ...formData, condition: e.target.value as Condition })
                    }
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select...</option>
                    {conditions.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    How much you paid (if you remember)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.howMuchPaid}
                    onChange={e =>
                      setFormData({ ...formData, howMuchPaid: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Estimated market value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimatedValue}
                    onChange={e =>
                      setFormData({ ...formData, estimatedValue: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Demo estimate only
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Would let go for
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.wouldLetGoFor}
                    onChange={e =>
                      setFormData({ ...formData, wouldLetGoFor: e.target.value })
                    }
                    disabled={formData.wouldLetGoForUnsure}
                    className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    placeholder="0"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="unsure"
                      checked={formData.wouldLetGoForUnsure}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          wouldLetGoForUnsure: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="unsure" className="text-sm text-muted-foreground">
                      Not sure
                    </label>
                  </div>
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
