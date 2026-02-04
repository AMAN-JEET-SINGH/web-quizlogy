import type { Metadata } from 'next'
import { AdminProvider } from '@/lib/adminContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'FF Admin Panel',
  description: 'Admin panel for managing categories and contests',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  )
}

