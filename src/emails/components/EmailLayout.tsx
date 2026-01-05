/**
 * Email layout component for transactional emails
 *
 * NOTE: This is a duplicate implementation from the marketing site
 * (lunastak.io/emails/components/EmailLayout.tsx).
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { Body, Container, Head, Html, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {children}

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Lunastak
              <br />
              <Link href="mailto:hello@lunastak.io" style={footerLink}>
                hello@lunastak.io
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px',
}

const footer = {
  backgroundColor: '#13231C',
  padding: '40px 20px',
  textAlign: 'center' as const,
  marginTop: '40px',
  borderRadius: '8px',
}

const footerText = {
  color: '#ffffff',
  fontSize: '14px',
  lineHeight: '150%',
  margin: '0',
}

const footerLink = {
  color: '#77CC88',
  textDecoration: 'underline',
}
