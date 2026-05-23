import { Text } from '@react-email/components'
import * as React from 'react'
import { colors } from '../lib/colors'

interface ParagraphProps {
  children: React.ReactNode
  style?: React.CSSProperties
  small?: boolean
}

export const Paragraph = ({ children, style, small = false }: ParagraphProps) => {
  return <Text style={{ ...(small ? smallStyle : paragraphStyle), ...style }}>{children}</Text>
}

const paragraphStyle = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.secondary,
  fontSize: '16px',
  lineHeight: '165%',
  margin: '0 0 16px',
}

const smallStyle = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.muted,
  fontSize: '14px',
  lineHeight: '150%',
  margin: '16px 0 0',
}
