import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import AppNav from '@/components/AppNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Alibaba Coffee Listing Bot',
  description: 'Product listing automation for coffee exporters on Alibaba.com.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="app-header">
          <div className="app-header__inner">
            <Link href="/" className="app-brand">
              <div className="app-brand__logo" aria-hidden>
                ☕
              </div>
              <h1 className="app-brand__title">
                Alibaba <span>CoffeeBot</span>
              </h1>
            </Link>
            <AppNav />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
