import React from 'react';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Strategy Statement Generator',
  description: 'Generate and visualize business strategy statements',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.className} bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`}
    >
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}
