'use client'

import type { Item } from '@/lib/types'

interface ItemRowProps {
  item: Item
  onClick: () => void
}

export default function ItemRow({ item, onClick }: ItemRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-border hover:bg-secondary transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{item.name}</p>
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            {item.category && <span>{item.category}</span>}
            {item.condition && <span>• {item.condition}</span>}
            {item.isSpecialCollectible && (
              <span className="text-foreground">• Collectible</span>
            )}
          </div>
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          {item.wouldLetGoFor && !item.wouldLetGoForUnsure && (
            <p className="text-sm font-medium text-foreground">
              ${item.wouldLetGoFor}
            </p>
          )}
          {item.wouldLetGoForUnsure && (
            <p className="text-sm text-muted-foreground">Not sure</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            {item.likelihoodToSell}
          </p>
        </div>
      </div>
    </button>
  )
}
