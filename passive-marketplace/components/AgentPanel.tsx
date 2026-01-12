'use client'

import { useState } from 'react'

interface AgentPanelProps {
  onCoordinate: (method: 'pickup' | 'ship', payment: 'venmo' | 'cash' | 'other') => void
  onClose: () => void
}

export default function AgentPanel({ onCoordinate, onClose }: AgentPanelProps) {
  const [method, setMethod] = useState<'pickup' | 'ship'>('pickup')
  const [payment, setPayment] = useState<'venmo' | 'cash' | 'other'>('venmo')

  const handleSubmit = () => {
    onCoordinate(method, payment)
  }

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-md sm:rounded-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex justify-between items-center">
          <h2 className="font-medium text-foreground">Coordination Agent</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-secondary rounded-lg p-4 text-sm text-muted-foreground">
            <p className="mb-2">
              The agent will coordinate this transaction while keeping both parties'
              identities private.
            </p>
            <ul className="space-y-1 ml-4">
              <li>• Negotiates on your behalf</li>
              <li>• Your exact identity stays hidden</li>
              <li>• Creates a group thread without revealing phone numbers</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Transfer method
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMethod('pickup')}
                className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                  method === 'pickup'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                Local pickup
              </button>
              <button
                onClick={() => setMethod('ship')}
                className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                  method === 'ship'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                Ship
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Payment method
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPayment('venmo')}
                className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                  payment === 'venmo'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                Venmo
              </button>
              <button
                onClick={() => setPayment('cash')}
                className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                  payment === 'cash'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                Cash
              </button>
              <button
                onClick={() => setPayment('other')}
                className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                  payment === 'other'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                Other
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Demo only: No real transactions or shipping labels
          </p>
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
          <button
            onClick={handleSubmit}
            className="w-full py-2 px-4 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Start coordination
          </button>
        </div>
      </div>
    </div>
  )
}
