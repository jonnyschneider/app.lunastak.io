import { Hr } from '@react-email/components'
import * as React from 'react'
import { colors } from '../lib/colors'

export const Divider = () => <Hr style={dividerStyle} />

const dividerStyle = {
  borderColor: colors.background.light,
  borderWidth: '1px 0 0 0',
  borderStyle: 'solid' as const,
  margin: '20px 0',
}
