import React from 'react';
import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { SessionProvider } from '@/components/SessionProvider'
import { SessionTransferProvider } from '@/components/providers/SessionTransferProvider'
import { BackgroundTaskProvider } from '@/components/providers/BackgroundTaskProvider'
import { DocumentProcessingProvider } from '@/components/providers/DocumentProcessingProvider'
import { StatsigProvider } from '@/components/StatsigProvider'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['italic'],
  variable: '--font-ibm-plex-mono',
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
      className={`${ibmPlexSans.className} ${ibmPlexMono.variable} bg-background`}
    >
      <body>
        <SessionProvider session={session}>
          <SessionTransferProvider>
            <StatsigProvider>
              <BackgroundTaskProvider>
                <DocumentProcessingProvider>
                  {children}
                  <Toaster position="bottom-right" />
                  <Analytics />
                </DocumentProcessingProvider>
              </BackgroundTaskProvider>
            </StatsigProvider>
          </SessionTransferProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
