'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Main">
      <Link href="/" className={`nav-link ${pathname === '/' ? 'nav-link--active' : ''}`}>
        Dashboard
      </Link>
      <Link
        href="/compare"
        className={`nav-link ${pathname.startsWith('/compare') ? 'nav-link--active' : ''}`}
      >
        Compare
      </Link>
      <Link
        href="/settings"
        className={`nav-link ${pathname.startsWith('/settings') ? 'nav-link--active' : ''}`}
      >
        Settings
      </Link>
    </nav>
  );
}
