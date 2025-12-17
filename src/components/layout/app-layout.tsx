'use client'

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
          {/* Navigation items will go here in future */}
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
      <SidebarFooter>
        <Dropdown>
          <DropdownButton as={SidebarSection}>
            <div className="flex items-center gap-3">
              <Avatar initials="AU" className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-909" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-950 dark:text-white">
                  Anonymous User
                </span>
              </div>
            </div>
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="top start">
            <DropdownItem href="#">
              <ArrowRightStartOnRectangleIcon />
              <DropdownLabel>Logout</DropdownLabel>
            </DropdownItem>
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
