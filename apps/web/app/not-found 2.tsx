import Link from 'next/link';

export default function NotFound(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-lg">
      <h1 className="font-heading text-display text-text-primary">404</h1>
      <p className="mt-md text-lg text-text-secondary">Page not found</p>
      <Link
        href="/browse"
        className="mt-xl rounded-md bg-accent px-xl py-md text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        Back to marketplace
      </Link>
    </main>
  );
}
