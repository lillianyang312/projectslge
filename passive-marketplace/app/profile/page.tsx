'use client'

import { useState, useEffect } from 'react'
import type { Profile, LocationKey } from '@/lib/types'
import {
  getProfile,
  saveProfile,
  loadDemoNeighborhoodData,
  generateId,
  resetDemoData,
} from '@/lib/store'
import { seedUsers, seedItems, seedWants, seedOffers } from '@/lib/seedData'

const locationKeys: { key: LocationKey; label: string }[] = [
  { key: 'campus', label: 'Campus / University' },
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'zip', label: 'Zip code area' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    ageRange: '' as Profile['ageRange'] | '',
    locationKey: 'campus' as LocationKey,
    locationValue: '',
    pickupAvailability: '',
    verifiedEmail: false,
  })

  useEffect(() => {
    const p = getProfile()
    if (p) {
      setProfile(p)
      setFormData({
        name: p.name,
        ageRange: p.ageRange || '',
        locationKey: p.locationKey,
        locationValue: p.locationValue,
        pickupAvailability: p.pickupAvailability || '',
        verifiedEmail: p.verifiedEmail,
      })
    } else {
      setEditing(true)
    }
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    const newProfile: Profile = {
      userId: profile?.userId || generateId(),
      name: formData.name,
      ageRange: formData.ageRange || undefined,
      locationKey: formData.locationKey,
      locationValue: formData.locationValue,
      pickupAvailability: formData.pickupAvailability || undefined,
      verifiedEmail: formData.verifiedEmail,
      pingsUsedToday: profile?.pingsUsedToday || 0,
      lastPingReset: profile?.lastPingReset || Date.now(),
    }

    saveProfile(newProfile)
    setProfile(newProfile)
    setEditing(false)
  }

  const handleLoadDemo = () => {
    if (confirm('Load demo neighborhood data? This will add 30+ mock users/items/wants/offers for testing.')) {
      loadDemoNeighborhoodData(seedUsers, seedItems, seedWants)
      seedOffers.forEach(offer => {
        localStorage.setItem('passive_marketplace_offers', JSON.stringify([...JSON.parse(localStorage.getItem('passive_marketplace_offers') || '[]'), offer]))
      })
      alert('Demo data loaded! Go to Matches to see potential matches.')
    }
  }

  const handleResetDemo = () => {
    if (confirm('Reset all demo data? This will clear neighborhood items, wants, and offers.')) {
      resetDemoData()
      alert('Demo data reset.')
    }
  }

  if (!profile || editing) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
          <h1 className="text-xl font-medium text-foreground">Profile</h1>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Name or alias *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Age range (optional)
            </label>
            <select
              value={formData.ageRange}
              onChange={e =>
                setFormData({
                  ...formData,
                  ageRange: e.target.value as Profile['ageRange'],
                })
              }
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Prefer not to say</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55+">55+</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Location type *
            </label>
            <select
              value={formData.locationKey}
              onChange={e =>
                setFormData({ ...formData, locationKey: e.target.value as LocationKey })
              }
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {locationKeys.map(lk => (
                <option key={lk.key} value={lk.key}>
                  {lk.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {formData.locationKey === 'campus'
                ? 'Campus area'
                : formData.locationKey === 'neighborhood'
                ? 'Neighborhood name'
                : 'Zip code'}{' '}
              *
            </label>
            <input
              type="text"
              required
              value={formData.locationValue}
              onChange={e =>
                setFormData({ ...formData, locationValue: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={
                formData.locationKey === 'campus'
                  ? 'e.g., North Campus'
                  : formData.locationKey === 'neighborhood'
                  ? 'e.g., Mission District'
                  : 'e.g., 94110'
              }
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Pickup availability windows (optional)
            </label>
            <input
              type="text"
              value={formData.pickupAvailability}
              onChange={e =>
                setFormData({ ...formData, pickupAvailability: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g., Weekdays after 5pm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verified"
              checked={formData.verifiedEmail}
              onChange={e =>
                setFormData({ ...formData, verifiedEmail: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label htmlFor="verified" className="text-sm text-foreground">
              Verified campus/institution email (demo stub)
            </label>
          </div>

          <div className="bg-secondary rounded-lg p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Privacy & Safety</p>
            <p>• Your exact identity and address are never shown</p>
            <p>• Buyers and sellers see only coarse proximity</p>
            <p>• Agent coordinates without revealing personal numbers</p>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Save Profile
          </button>

          {profile && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full py-2 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
        <h1 className="text-xl font-medium text-foreground">Profile</h1>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Name</p>
          <p className="text-foreground">{profile.name}</p>
        </div>

        {profile.ageRange && (
          <div>
            <p className="text-sm text-muted-foreground">Age range</p>
            <p className="text-foreground">{profile.ageRange}</p>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Location</p>
          <p className="text-foreground capitalize">
            {profile.locationKey}: {profile.locationValue}
          </p>
        </div>

        {profile.pickupAvailability && (
          <div>
            <p className="text-sm text-muted-foreground">Pickup availability</p>
            <p className="text-foreground">{profile.pickupAvailability}</p>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Email verification</p>
          <p className="text-foreground">
            {profile.verifiedEmail ? 'Verified' : 'Not verified'}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Pings used today</p>
          <p className="text-foreground">
            {profile.pingsUsedToday} / 5
          </p>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="w-full py-2 px-4 border border-border rounded hover:bg-secondary transition-colors text-foreground"
        >
          Edit Profile
        </button>

        <div className="pt-4 border-t border-border space-y-3">
          <button
            onClick={handleLoadDemo}
            className="w-full py-2 px-4 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
          >
            Load demo neighborhood data
          </button>
          <button
            onClick={handleResetDemo}
            className="w-full py-2 px-4 border border-red-500 text-red-500 rounded hover:bg-red-50 transition-colors"
          >
            Reset demo data
          </button>
          <p className="text-xs text-muted-foreground">
            Loads 30+ mock users, items, wants, and offers for testing
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Privacy & Safety</p>
          <p>• Your exact identity and address are never shown</p>
          <p>• Buyers and sellers see only coarse proximity</p>
          <p>• Agent coordinates without revealing personal numbers</p>
        </div>
      </div>
    </div>
  )
}
