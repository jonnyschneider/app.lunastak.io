'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface HeaderContextValue {
  tabNav: ReactNode
  setTabNav: (node: ReactNode) => void
  rightSlot: ReactNode
  setRightSlot: (node: ReactNode) => void
}

const HeaderContext = createContext<HeaderContextValue>({
  tabNav: null,
  setTabNav: () => {},
  rightSlot: null,
  setRightSlot: () => {},
})

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [tabNav, setTabNavState] = useState<ReactNode>(null)
  const [rightSlot, setRightSlotState] = useState<ReactNode>(null)

  const setTabNav = useCallback((node: ReactNode) => {
    setTabNavState(node)
  }, [])

  const setRightSlot = useCallback((node: ReactNode) => {
    setRightSlotState(node)
  }, [])

  return (
    <HeaderContext.Provider value={{ tabNav, setTabNav, rightSlot, setRightSlot }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeaderTabNav() {
  const { setTabNav, setRightSlot } = useContext(HeaderContext)
  return { setTabNav, setRightSlot }
}

export function useHeaderSlot() {
  const { tabNav, rightSlot } = useContext(HeaderContext)
  return { tabNav, rightSlot }
}
