'use client'

import type { Want } from '@/lib/types'

interface WantRowProps {
  want: Want
  onClick: () => void
}

export default function WantRow({ want, onClick }: WantRowProps) {
  const getUrgencyColor = (urgency: Want['urgency']) => {
    switch (urgency) {
      case 'urgent':
        return 'text-foreground'
      case 'interested':
        return 'text-muted-foreground'
      case 'casual':
        return 'text-muted-foreground/70'
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-border hover:bg-secondary transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{want.name}</p>
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            {want.category && <span>{want.category}</span>}
            {want.isGeneralInterest && <span>• General interest</span>}
          </div>
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          {want.maxOffer && (
            <p className="text-sm font-medium text-foreground">
              Max ${want.maxOffer}
            </p>
          )}
          <p className={`text-xs mt-1 capitalize ${getUrgencyColor(want.urgency)}`}>
            {want.urgency}
          </p>
        </div>
      </div>
    </button>
  )
}
