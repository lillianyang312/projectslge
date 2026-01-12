'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-12">
        <h1 className="text-2xl font-medium text-foreground mb-2">Passive Marketplace</h1>
        <p className="text-sm text-muted-foreground">A quiet place to buy and sell</p>
      </div>

      <div className="space-y-3">
        <Link href="/upload" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">Upload</h2>
          <p className="text-sm text-muted-foreground">Add item by photo</p>
        </Link>

        <Link href="/swipe" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">Swipe</h2>
          <p className="text-sm text-muted-foreground">Quick browse & match</p>
        </Link>

        <Link href="/list" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">My List</h2>
          <p className="text-sm text-muted-foreground">Items you own</p>
        </Link>

        <Link href="/wants" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">My Wants</h2>
          <p className="text-sm text-muted-foreground">What you're looking for</p>
        </Link>

        <Link href="/matches" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">Matches</h2>
          <p className="text-sm text-muted-foreground">See connections</p>
        </Link>

        <Link href="/profile" className="block p-6 border border-border rounded-lg hover:bg-secondary transition-colors">
          <h2 className="font-medium text-foreground mb-1">Profile</h2>
          <p className="text-sm text-muted-foreground">Settings & demo data</p>
        </Link>
      </div>
    </div>
  )
}
