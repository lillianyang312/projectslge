'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui';

const NAV_LINKS = [
  { href: '/browse', label: 'Browse' },
  { href: '/my-list', label: 'My Items', auth: true },
  { href: '/deals', label: 'My Offers', auth: true },
  { href: '/inbox', label: 'Inbox', auth: true },
];

export default function Navbar(): React.ReactElement {
  const pathname = usePathname();
  const { isAuthed, profile, signOut } = useAuthStore();

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-lg">
        <div className="flex items-center gap-3xl">
          <Link href={isAuthed ? '/browse' : '/'} className="font-heading text-xl font-semibold text-text-primary">
            Sellryte
          </Link>

          <div className="hidden items-center gap-xl md:flex">
            {NAV_LINKS.filter((l) => !l.auth || isAuthed).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-md">
          {isAuthed ? (
            <>
              <Link
                href="/upload"
                className="hidden rounded-md bg-accent px-lg py-sm text-sm font-medium text-white transition-opacity hover:opacity-90 sm:inline-flex"
              >
                List Item
              </Link>

              <div className="relative group">
                <Link href="/profile" className="flex items-center gap-sm">
                  <Avatar name={profile?.full_name} size="sm" />
                </Link>

                <div className="absolute right-0 top-full hidden w-48 rounded-md border border-border bg-card p-xs shadow-lg group-hover:block">
                  <Link
                    href="/profile"
                    className="block rounded-sm px-md py-sm text-sm text-text-primary hover:bg-accent-soft"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="block w-full rounded-sm px-md py-sm text-left text-sm text-danger hover:bg-danger-soft"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent px-lg py-sm text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
