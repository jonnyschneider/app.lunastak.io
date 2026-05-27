import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { colors } from '../lib/colors'

interface EmailLayoutProps {
  children: React.ReactNode
  preview: string
  unsubscribeUrl?: string
  webviewUrl?: string
}

export const EmailLayout = ({
  children,
  preview,
  unsubscribeUrl,
  webviewUrl,
}: EmailLayoutProps) => {
  const showFooterLinks = !!unsubscribeUrl || !!webviewUrl

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo / wordmark */}
          <Section style={logoSection}>
            <Img
              src="https://cdn.sanity.io/images/6i6wbquj/production/c05e8b689484ae8ac0cac77175311475167c9fa0-2480x1860.png?w=400&fm=png&fit=max"
              width="170"
              alt="Lunastak"
              style={logoImg}
            />
          </Section>

          {/* Main content */}
          <Section style={contentWrapper}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Lunastak — AI Strategy Coach
              <br />
              <Link href="mailto:luna@lunastak.io" style={footerLink}>
                luna@lunastak.io
              </Link>
            </Text>
            {showFooterLinks && (
              <Text style={footerLinks}>
                {webviewUrl && (
                  <>
                    <Link href={webviewUrl} style={footerLink}>
                      View in browser
                    </Link>
                    {' · '}
                  </>
                )}
                {unsubscribeUrl && (
                  <Link href={unsubscribeUrl} style={footerLink}>
                    Unsubscribe
                  </Link>
                )}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: colors.background.white,
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: colors.background.white,
}

const logoSection = {
  padding: '32px 20px 20px',
  textAlign: 'center' as const,
}

const logoImg = {
  display: 'inline-block',
  margin: '0 auto',
  height: 'auto' as const,
}

const contentWrapper = {
  padding: '0 20px',
}

const footer = {
  backgroundColor: colors.background.dark,
  padding: '32px 20px',
  textAlign: 'center' as const,
  marginTop: '40px',
  borderRadius: '8px',
}

const footerText = {
  color: colors.background.white,
  fontSize: '14px',
  lineHeight: '165%',
  margin: '0 0 16px',
}

const footerLinks = {
  color: colors.background.white,
  fontSize: '12px',
  lineHeight: '150%',
  margin: 0,
}

const footerLink = {
  color: colors.green[500],
  textDecoration: 'underline',
}
