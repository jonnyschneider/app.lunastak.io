import { Button as EmailButton } from '@react-email/components'
import * as React from 'react'
import { colors } from '../lib/colors'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export const Button = ({ href, children, variant = 'primary' }: ButtonProps) => {
  const style = variant === 'primary' ? primaryButtonStyle : secondaryButtonStyle
  return (
    <EmailButton href={href} style={style}>
      {children}
    </EmailButton>
  )
}

const primaryButtonStyle = {
  backgroundColor: colors.cta.primary,
  color: colors.text.primary,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  borderRadius: '6px',
  lineHeight: '1',
}

const secondaryButtonStyle = {
  backgroundColor: colors.background.white,
  color: colors.ink[900],
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 'normal' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '10px 25px',
  borderRadius: '6px',
  lineHeight: '16px',
  border: `1px solid ${colors.ink[900]}`,
}
