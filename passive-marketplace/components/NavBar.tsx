'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()

  const links = [
    { href: '/list', label: 'My List' },
    { href: '/wants', label: 'Wants' },
    { href: '/matches', label: 'Matches' },
    { href: '/profile', label: 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
      <div className="max-w-2xl mx-auto flex">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-1 py-3 text-center text-sm transition-colors ${
              pathname === link.href
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
