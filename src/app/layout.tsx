import React from 'react';
import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import '@/styles/globals.css'
import { SessionProvider } from '@/components/SessionProvider'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Lunastak - The Strategy App',
  description: 'Crystallize your business thinking into clear strategic direction',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html
      lang="en"
      className={`${ibmPlexSans.className} bg-background`}
    >
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
