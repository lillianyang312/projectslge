# Upgrade Guide: Passive Marketplace V2

## Completed Changes

✅ Updated types with shipping preferences, swipe actions, uploads, negotiations
✅ Expanded store with new persistence layer
✅ Expanded seed data to 30 items, 25 wants, 4 offers with shipping prefs
✅ Updated matching logic for shipping compatibility and interest decay

## Remaining Changes Needed

### 1. Update ItemModal.tsx
Add shipping preference selector:
```tsx
<div>
  <label className="block text-sm text-muted-foreground mb-2">
    Shipping preference
  </label>
  <div className="flex gap-2">
    <button type="button" onClick={() => setFormData({...formData, shippingPreference: 'local only'})}
      className={formData.shippingPreference === 'local only' ? 'active' : ''}>
      Local only
    </button>
    <button type="button" onClick={() => setFormData({...formData, shippingPreference: 'shipping ok'})}
      className={formData.shippingPreference === 'shipping ok' ? 'active' : ''}>
      Shipping OK
    </button>
  </div>
</div>
```

### 2. Update WantModal.tsx
Add shipping preference and auto-increment:
```tsx
<div>
  <label>Shipping preference</label>
  {/* Same as ItemModal */}
</div>
<div>
  <label>Auto-increment step (optional)</label>
  <select value={formData.autoIncrementStep} onChange={...}>
    <option value="">None</option>
    <option value="5">+$5</option>
    <option value="10">+$10</option>
    <option value="20">+$20</option>
  </select>
</div>
```

### 3. Update app/list/page.tsx
- Initialize items with `shippingPreference: 'local only'` default
- Add default `imageUrl: undefined`

### 4. Update app/wants/page.tsx
- Initialize wants with `shippingPreference: 'shipping ok'` default
- Add `lastInteractionAt: Date.now()` on creation
- Add staleness banner for stale wants

### 5. Update app/matches/page.tsx
- Add shipping badge to MatchCard props
- Pass negotiation state to updated AgentPanel

### 6. Update MatchCard.tsx
Add shipping badge display:
```tsx
<div className="flex gap-2">
  {itemShippingPref === 'local only' && (
    <span className="text-xs px-2 py-1 bg-secondary rounded">Local pickup</span>
  )}
  {itemShippingPref === 'shipping ok' && (
    <span className="text-xs px-2 py-1 bg-secondary rounded">Shipping OK</span>
  )}
</div>
```

### 7. Create app/page.tsx (Home)
```tsx
'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-medium mb-8">Passive Marketplace</h1>
      <div className="space-y-4">
        <Link href="/upload" className="block p-6 border rounded hover:bg-secondary">
          <h2 className="font-medium mb-2">Upload</h2>
          <p className="text-sm text-muted-foreground">Add item by photo</p>
        </Link>
        <Link href="/swipe" className="block p-6 border rounded hover:bg-secondary">
          <h2 className="font-medium mb-2">Swipe</h2>
          <p className="text-sm text-muted-foreground">Quick browse & match</p>
        </Link>
        <Link href="/list" className="block p-6 border rounded hover:bg-secondary">
          <h2 className="font-medium mb-2">My List</h2>
          <p className="text-sm text-muted-foreground">Items you own</p>
        </Link>
        <Link href="/wants" className="block p-6 border rounded hover:bg-secondary">
          <h2 className="font-medium mb-2">My Wants</h2>
          <p className="text-sm text-muted-foreground">What you're looking for</p>
        </Link>
      </div>
    </div>
  )
}
```

### 8. Create app/upload/page.tsx
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/lib/types'

const fakeClassifier = (filename: string, caption: string): {title: string, category?: Category} => {
  const text = (filename + ' ' + caption).toLowerCase()
  if (text.includes('iphone') || text.includes('phone')) return {title: 'iPhone', category: 'Electronics'}
  if (text.includes('laptop') || text.includes('macbook')) return {title: 'Laptop', category: 'Electronics'}
  if (text.includes('desk') || text.includes('table')) return {title: 'Desk', category: 'Furniture'}
  if (text.includes('bike') || text.includes('bicycle')) return {title: 'Bike', category: 'Sports'}
  if (text.includes('book')) return {title: 'Book', category: 'Books'}
  if (text.includes('jacket') || text.includes('coat')) return {title: 'Jacket', category: 'Clothing'}
  return {title: 'Item', category: undefined}
}

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [detected, setDetected] = useState<{title: string, category?: Category} | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedCategory, setEditedCategory] = useState<Category | ''>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      const result = fakeClassifier(f.name, caption)
      setDetected(result)
      setEditedTitle(result.title)
      setEditedCategory(result.category || '')
    }
  }

  const handleAddToList = () => {
    // Save upload + add to My List
    router.push('/list')
  }

  const handleAddToWants = () => {
    // Save upload + add to My Wants
    router.push('/wants')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-medium mb-6">Upload Item</h1>

      <div className="border-2 border-dashed border-border rounded-lg p-12 text-center mb-6">
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="file-input" />
        <label htmlFor="file-input" className="cursor-pointer">
          {file ? (
            <p className="text-foreground">{file.name}</p>
          ) : (
            <p className="text-muted-foreground">Drop image or click to upload</p>
          )}
        </label>
      </div>

      {detected && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Detected title</label>
            <input type="text" value={editedTitle} onChange={e => setEditedTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Category</label>
            <select value={editedCategory} onChange={e => setEditedCategory(e.target.value as Category)}
              className="w-full px-3 py-2 border rounded">
              <option value="">Select...</option>
              {['Electronics', 'Furniture', 'Clothing', 'Books', 'Kitchen', 'Sports', 'Collectibles', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddToList} className="flex-1 py-3 bg-foreground text-background rounded">
              Add to My List
            </button>
            <button onClick={handleAddToWants} className="flex-1 py-3 border rounded">
              Add to My Wants
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 9. Create app/swipe/page.tsx
```tsx
'use client'
import { useState, useEffect } from 'react'
import { getNeighborhoodItems, getProfile, saveSwipeAction, generateId } from '@/lib/store'
import type { SwipeActionType, RejectReason } from '@/lib/types'

export default function SwipePage() {
  const [mode, setMode] = useState<'buying' | 'selling'>('buying')
  const [deck, setDeck] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showRejectReasons, setShowRejectReasons] = useState(false)

  useEffect(() => {
    if (mode === 'buying') {
      setDeck(getNeighborhoodItems())
    }
  }, [mode])

  const handleSwipe = (action: SwipeActionType, reason?: RejectReason) => {
    const profile = getProfile()
    if (!profile) return

    const current = deck[currentIndex]
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

  const current = deck[currentIndex]
  if (!current) return <div className="p-4">No more items</div>

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col">
      <div className="p-4 border-b flex gap-2">
        <button onClick={() => setMode('buying')} className={mode === 'buying' ? 'font-medium' : ''}>Buying</button>
        <button onClick={() => setMode('selling')} className={mode === 'selling' ? 'font-medium' : ''}>Selling</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm border rounded-lg p-6">
          <h2 className="text-xl font-medium mb-2">{current.name}</h2>
          <p className="text-sm text-muted-foreground mb-4">{current.category}</p>
          {current.wouldLetGoFor && <p className="text-lg mb-4">${current.wouldLetGoFor}</p>}
          <p className="text-xs text-muted-foreground mb-4 capitalize">{current.shippingPreference}</p>

          {!showRejectReasons ? (
            <div className="flex gap-2">
              <button onClick={() => handleSwipe('reject')} className="flex-1 py-2 border rounded">❌</button>
              <button onClick={() => handleSwipe('save')} className="flex-1 py-2 border rounded">➡️</button>
              <button onClick={() => handleSwipe('interested')} className="flex-1 py-2 bg-foreground text-background rounded">✅</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Why not interested?</p>
              {(['too expensive', 'wrong condition', 'too far', 'shipping not ok', 'not what I meant'] as RejectReason[]).map(r => (
                <button key={r} onClick={() => handleSwipe('reject', r)} className="w-full py-2 border rounded text-sm">
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 10. Create components/NegotiationPanel.tsx
```tsx
'use client'
import { useState } from 'react'

interface NegotiationPanelProps {
  buyerMax?: number
  sellerAsk?: number
  currentOffer?: number
  autoIncrementStep?: number
  onUpdate: (newMax: number, newStep?: number) => void
  onClose: () => void
}

export default function NegotiationPanel({ buyerMax, sellerAsk, currentOffer, autoIncrementStep, onUpdate, onClose }: NegotiationPanelProps) {
  const [max, setMax] = useState(buyerMax?.toString() || '')
  const [step, setStep] = useState(autoIncrementStep?.toString() || '')

  const suggestion = sellerAsk && buyerMax ? Math.round((sellerAsk + buyerMax) / 2) : sellerAsk || buyerMax

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-md sm:rounded-lg p-4">
        <div className="flex justify-between mb-4">
          <h2 className="font-medium">Agent Negotiation</h2>
          <button onClick={onClose} className="text-muted-foreground">Close</button>
        </div>

        <div className="space-y-3 text-sm mb-4">
          {sellerAsk && <p>Seller asking: ${sellerAsk}</p>}
          {currentOffer && <p>Your current offer: ${currentOffer}</p>}
          {suggestion && <p className="text-foreground">Agent suggests: ${suggestion}</p>}
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Your max price</label>
            <input type="number" value={max} onChange={e => setMax(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Auto-increment step</label>
            <select value={step} onChange={e => setStep(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="">None</option>
              <option value="5">+$5</option>
              <option value="10">+$10</option>
              <option value="20">+$20</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">If accepted, be ready to confirm within 24h.</p>

        <button onClick={() => onUpdate(parseFloat(max), step ? parseInt(step) : undefined)} className="w-full py-2 bg-foreground text-background rounded">
          Update & Negotiate
        </button>
      </div>
    </div>
  )
}
```

### 11. Update NavBar.tsx
Add Home link:
```tsx
const links = [
  { href: '/', label: 'Home' },
  { href: '/list', label: 'List' },
  { href: '/wants', label: 'Wants' },
  { href: '/matches', label: 'Matches' },
  { href: '/profile', label: 'Profile' },
]
```

### 12. Update app/profile/page.tsx
Add reset demo button:
```tsx
import { resetDemoData } from '@/lib/store'

const handleResetDemo = () => {
  if (confirm('Reset all demo data?')) {
    resetDemoData()
    alert('Demo data reset')
  }
}

// In JSX:
<button onClick={handleResetDemo} className="w-full py-2 border border-red-500 text-red-500 rounded">
  Reset Demo Data
</button>
```

### 13. Update store.ts loadDemoNeighborhoodData
Add offers loading:
```tsx
import { seedOffers } from './seedData'

export const loadDemoNeighborhoodData = (users, items, wants, offers) => {
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_USERS, JSON.stringify(users))
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_ITEMS, JSON.stringify(items))
  localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD_WANTS, JSON.stringify(wants))
  localStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(offers))
}
```

Call with: `loadDemoNeighborhoodData(seedUsers, seedItems, seedWants, seedOffers)`

## Testing Checklist

- [ ] npm install && npm run dev works
- [ ] Home page shows all links
- [ ] Upload page accepts images and detects titles
- [ ] Swipe page shows deck with actions
- [ ] Items and wants save with shipping preferences
- [ ] Matches respect shipping compatibility
- [ ] Negotiation panel shows suggestions
- [ ] Stale wants show "Still interested?" banner after 30 days
- [ ] Interest decay lowers match priority after 7/14 days
- [ ] Demo data loads 30+ items with existing offers
- [ ] Reset demo clears neighborhood data
