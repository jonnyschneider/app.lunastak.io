import * as React from 'react'
import { colors } from '../lib/colors'

interface ListProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export const List = ({ children, style }: ListProps) => (
  <ul style={{ ...listStyle, ...style }}>{children}</ul>
)

export const OrderedList = ({ children, style }: ListProps) => (
  <ol style={{ ...listStyle, ...style }}>{children}</ol>
)

export const ListItem = ({ children, style }: ListProps) => (
  <li style={{ ...listItemStyle, ...style }}>{children}</li>
)

const listStyle = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.secondary,
  fontSize: '16px',
  lineHeight: '165%',
  margin: '0 0 16px',
  paddingLeft: '20px',
}

const listItemStyle = {
  marginBottom: '8px',
}
