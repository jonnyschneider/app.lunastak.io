'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

/**
 * The one slot a page can push into the app header: `tabNav`, the centre navigation. On a project it
 * is `ProjectTabNav`; an empty project pushes `null` so the header has no nav at all.
 *
 * There used to be a `rightSlot` as well, for demo mode to replace the project switcher and account
 * menu. Nothing had written to it since the demos moved into the switcher's Examples group
 * (2026-09-10), so it went on 2026-09-11 rather than stay as a second, silent way to take over the
 * header.
 */
interface HeaderContextValue {
  tabNav: ReactNode
  setTabNav: (node: ReactNode) => void
}

const HeaderContext = createContext<HeaderContextValue>({
  tabNav: null,
  setTabNav: () => {},
})

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [tabNav, setTabNavState] = useState<ReactNode>(null)

  const setTabNav = useCallback((node: ReactNode) => {
    setTabNavState(node)
  }, [])

  return (
    <HeaderContext.Provider value={{ tabNav, setTabNav }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeaderTabNav() {
  const { setTabNav } = useContext(HeaderContext)
  return { setTabNav }
}

export function useHeaderSlot() {
  const { tabNav } = useContext(HeaderContext)
  return { tabNav }
}
