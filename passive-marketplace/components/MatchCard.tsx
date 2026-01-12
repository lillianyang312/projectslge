'use client'

import type { Match } from '@/lib/types'

interface MatchCardProps {
  match: Match & {
    itemName: string
    wantName: string
    buyerMax?: number
    sellerAsk?: number
    estimatedValue?: number
  }
  direction: 'want' | 'sell'
  onRequestAgent: () => void
}

export default function MatchCard({ match, direction, onRequestAgent }: MatchCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-medium text-foreground">{match.itemName}</p>
          <p className="text-sm text-muted-foreground mt-1">{match.proximity}</p>
        </div>
        {!match.seen && (
          <span className="text-xs bg-foreground text-background px-2 py-1 rounded">
            New
          </span>
        )}
      </div>

      <div className="space-y-1 mb-3 text-sm">
        {match.buyerMax && (
          <p className="text-muted-foreground">
            Buyer max: <span className="text-foreground">${match.buyerMax}</span>
          </p>
        )}
        {match.sellerAsk && (
          <p className="text-muted-foreground">
            Would let go for: <span className="text-foreground">${match.sellerAsk}</span>
          </p>
        )}
        {match.estimatedValue && (
          <p className="text-muted-foreground">
            Est. value: <span className="text-foreground">${match.estimatedValue}</span>
          </p>
        )}
      </div>

      {!match.agentRequested ? (
        <button
          onClick={onRequestAgent}
          className="w-full py-2 px-4 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors text-sm font-medium"
        >
          Ask agent to coordinate
        </button>
      ) : (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Agent coordinating</p>
          {match.coordinationMethod && (
            <p>Method: {match.coordinationMethod === 'pickup' ? 'Local pickup' : 'Ship'}</p>
          )}
          {match.paymentMethod && (
            <p className="capitalize">Payment: {match.paymentMethod}</p>
          )}
          {match.groupTextStarted && (
            <p className="mt-2 text-foreground">Group thread started</p>
          )}
        </div>
      )}
    </div>
  )
}
