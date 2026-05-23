import { Section } from '@react-email/components'
import * as React from 'react'

interface ContentSectionProps {
  children: React.ReactNode
}

export const ContentSection = ({ children }: ContentSectionProps) => (
  <Section style={sectionStyle}>{children}</Section>
)

const sectionStyle = { padding: '20px 0' }
