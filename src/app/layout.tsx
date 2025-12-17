import React from 'react';
import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import '@/styles/globals.css'
import { SessionProvider } from '@/components/SessionProvider'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Lunastak - The Strategy App',
  description: 'Crystallize your business thinking into clear strategic direction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.className} bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`}
    >
      <body suppressHydrationWarning={true}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
