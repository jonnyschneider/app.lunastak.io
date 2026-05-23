import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { Button } from './Button'
import { colors } from '../lib/colors'

interface CalloutBoxProps {
  text: string
  buttonText: string
  buttonHref: string
}

export const CalloutBox = ({ text, buttonText, buttonHref }: CalloutBoxProps) => {
  return (
    <Section style={container}>
      <table width="100%" style={tableStyle}>
        <tr>
          <td style={textCell}>
            <Text style={textStyle}>{text}</Text>
          </td>
          <td style={buttonCell}>
            <Button href={buttonHref} variant="secondary">
              {buttonText}
            </Button>
          </td>
        </tr>
      </table>
    </Section>
  )
}

const container = { margin: '40px 0' }

const tableStyle = {
  backgroundColor: colors.green[500],
  borderRadius: '8px',
  padding: '16px 20px 16px 30px',
  width: '100%',
}

const textStyle = {
  fontFamily: "'DM Sans', sans-serif",
  color: colors.text.primary,
  fontSize: '16px',
  lineHeight: '165%',
  margin: 0,
}

const textCell = { paddingRight: '20px' }
const buttonCell = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }
