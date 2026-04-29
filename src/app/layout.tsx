import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Alibaba Coffee Listing Bot | Premium Seller Tools',
  description: 'AI-powered product listing automation for elite coffee exporters.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          <header style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>☕</div>
                <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Alibaba <span style={{ color: 'white' }}>CoffeeBot</span></h1>
              </div>
              <nav style={{ display: 'flex', gap: '24px' }}>
                <a href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>Dashboard</a>
                <span style={{ color: 'var(--foreground)', fontSize: '0.9rem', opacity: 0.3, cursor: 'not-allowed' }}>Products</span>
                <a href="/settings" style={{ color: 'var(--foreground)', textDecoration: 'none', fontSize: '0.9rem', opacity: 0.7 }}>Settings</a>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
