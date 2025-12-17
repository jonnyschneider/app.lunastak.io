'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Bars3Icon } from '@heroicons/react/20/solid'
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/16/solid'
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from '@/components/ui/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
} from '@/components/ui/sidebar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/ui/dropdown'
import { Avatar } from '@/components/ui/avatar'

interface SavedStrategy {
  id: string
  conversationId: string
  createdAt: string
  output: {
    vision?: string
    mission?: string
  }
}

export function AppLayout({
  children,
  experimentVariant = 'baseline-v1'
}: {
  children: React.ReactNode;
  experimentVariant?: string;
}) {
  return (
    <SidebarLayout
      navbar={<AppNavbar />}
      sidebar={<AppSidebar experimentVariant={experimentVariant} />}
    >
      {children}
    </SidebarLayout>
  )
}

function AppNavbar() {
  return (
    <Navbar>
      <NavbarSpacer />
      <NavbarSection>
        <Dropdown>
          <DropdownButton as={NavbarItem}>
            <Avatar initials="AU" className="bg-zinc-900 text-white" />
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="bottom end">
            <DropdownItem href="#">
              <ArrowRightStartOnRectangleIcon />
              <DropdownLabel>Logout</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarSection>
    </Navbar>
  )
}

function AppSidebar({ experimentVariant = 'baseline-v1' }: { experimentVariant?: string }) {
  const { data: session } = useSession()
  const [strategies, setStrategies] = useState<SavedStrategy[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      fetchStrategies()
    }
  }, [session])

  const fetchStrategies = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/strategies')
      if (response.ok) {
        const data = await response.json()
        setStrategies(data.strategies)
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getUserInitials = () => {
    if (!session?.user?.name && !session?.user?.email) return 'AU'
    const name = session.user.name || session.user.email || ''
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getUserDisplay = () => {
    return session?.user?.name || session?.user?.email || 'Anonymous User'
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-zinc-950 dark:text-white">
              Decision Stack
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {session && (
            <>
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                  Saved Strategies
                </h3>
              </div>
              {isLoading && (
                <div className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Loading...
                </div>
              )}
              {!isLoading && strategies.length === 0 && (
                <div className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No saved strategies yet
                </div>
              )}
              {!isLoading && strategies.map((strategy) => (
                <Link
                  key={strategy.id}
                  href={`/strategy/${strategy.id}`}
                  className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <div className="font-medium truncate">
                    {strategy.output.vision?.substring(0, 50) || 'Untitled Strategy'}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500">
                    {new Date(strategy.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </>
          )}
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
      <SidebarFooter>
        <Dropdown>
          <DropdownButton as={SidebarSection}>
            <div className="flex items-center gap-3">
              <Avatar initials={getUserInitials()} className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-909" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-950 dark:text-white">
                  {getUserDisplay()}
                </span>
              </div>
            </div>
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="top start">
            {session && (
              <DropdownItem onClick={() => signOut()}>
                <ArrowRightStartOnRectangleIcon />
                <DropdownLabel>Logout</DropdownLabel>
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
        <div className="px-4 py-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {experimentVariant}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
