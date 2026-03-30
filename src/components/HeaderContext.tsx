'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

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
