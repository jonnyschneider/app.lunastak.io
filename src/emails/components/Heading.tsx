import { Heading as EmailHeading } from '@react-email/components'
import * as React from 'react'
import { colors } from '../lib/colors'

interface HeadingProps {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
}

export const Heading = ({ children, as = 'h1' }: HeadingProps) => {
  const style = as === 'h1' ? h1Style : as === 'h2' ? h2Style : h3Style
  return (
    <EmailHeading as={as} style={style}>
      {children}
    </EmailHeading>
  )
}

const h1Style = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.primary,
  fontSize: '32px',
  lineHeight: '1.2',
  fontWeight: 'bold' as const,
  margin: '0 0 20px',
}

const h2Style = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.primary,
  fontSize: '24px',
  lineHeight: '1.25',
  fontWeight: '600' as const,
  margin: '0 0 16px',
}

const h3Style = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.primary,
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600' as const,
  margin: '0 0 12px',
}
