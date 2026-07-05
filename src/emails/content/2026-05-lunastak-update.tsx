import * as React from 'react'
import { Column, Img, Link, Row, Section } from '@react-email/components'
import { Button, Divider, Heading, Paragraph } from '../components'
import type { BroadcastContent } from '../broadcast-template'

// --- UTM-tagged links (campaign logged in 03-Marketing/Content/Writing/Content-Register.md) ---
const CAMPAIGN = 'utm_source=newsletter&utm_medium=email&utm_campaign=may-2026-lunastak-mailout'
const openAppUrl = `https://www.lunastak.io?${CAMPAIGN}&utm_content=open-app-cta`
const installUrl = `https://www.lunastak.io/docs/install?${CAMPAIGN}&utm_content=plugin-install`
const ferrariUrl = `https://app.lunastak.io/demo/ferrari?${CAMPAIGN}&utm_content=ferrari-demo`
const insightsUrl = `https://www.humventures.com.au/insights?${CAMPAIGN}&utm_content=ai-perspectives-ps`

// Knowledgebase/Evidence screenshot — paste the Sanity asset URL (without query string) once captured.
const KB_SHOT = 'https://cdn.sanity.io/images/6i6wbquj/production/3d6cfe17311ad2d196c90bc113cd315f65b6521c-4599x4215.png'

// --- Sanity-hosted logo masters (2480x1860, served at 2x via transform) ---
const cdn = (id: string, w: number) =>
  `https://cdn.sanity.io/images/6i6wbquj/production/${id}-2480x1860.png?w=${w}&fm=png&fit=max`
const LOGOS = {
  claudeCode: 'd9fe6cf88bf90a94d8c2d2ff41c9f8fd292bc1a7',
  nike: '873f9e6f56ddbbea6b2423accb020707b69a76d8',
  costco: 'd14919f3c7d96b82d81e13b6dad7a49eb78cf33e',
  tsmc: 'a5879a0a016a176924aafb69ac656cc50ca8287f',
  ferrari: 'b6cd1611336a2cea1fc510057a83c64b7af2a491',
}

const Logo = ({ id, alt, w }: { id: string; alt: string; w: number }) => (
  <Img src={cdn(id, w * 2)} alt={alt} width={w} style={{ display: 'block', margin: '0 auto', height: 'auto' }} />
)

const codeBlock = {
  backgroundColor: '#f6f8f7',
  borderRadius: '6px',
  padding: '14px 16px',
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontSize: '13px',
  lineHeight: '1.7',
  color: '#13231C',
  overflowX: 'auto' as const,
}

const inlineCode = {
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  backgroundColor: '#f6f8f7',
  padding: '1px 5px',
  borderRadius: '4px',
  fontSize: '14px',
}

const link = {
  color: '#5fb371',
  textDecoration: 'underline',
}

const logoCell = {
  textAlign: 'center' as const,
  padding: '8px 6px',
  verticalAlign: 'middle' as const,
}

const screenshot = {
  display: 'block',
  margin: '0 auto',
  width: '100%',
  maxWidth: '560px',
  height: 'auto' as const,
  borderRadius: '8px',
  border: '1px solid #e6ece9',
}

export const broadcastContent: BroadcastContent = {
  subject: 'Still a side project. Still got a lot better.',
  previewText: 'A Claude plugin, see and edit the thinking behind your strategy, and a Decision Stack for Ferrari.',
  body: (
    <>
      <Paragraph>Hey there,</Paragraph>

      <Paragraph>
        It&rsquo;s been heads-down here for a few months. Lunastak got a fair bit better, and some of you were
        generous with feedback while it was still rough. Thank you for that.
      </Paragraph>

      <Paragraph>
        First, this is a small list, and all of you are on free usage. That&rsquo;s deliberate. Lunastak&rsquo;s as
        much a learning experiment as a product right now, and I&rsquo;d rather it got used than locked down. So
        here&rsquo;s what&rsquo;s worth coming back for.
      </Paragraph>

      <Section style={{ textAlign: 'center', margin: '8px 0 0' }}>
        <Logo id={LOGOS.claudeCode} alt="Claude Code" w={104} />
      </Section>
      <Heading as="h3">Install the Claude Code Plugin</Heading>
      <Paragraph>
        You can already build a stack inside the app: Luna asks the right questions, or you upload a few docs (up to
        three) and it runs with that. The plugin moves the context-gathering into the tools you already use, so
        it&rsquo;s faster and your source material never leaves your machine. Luna still does the magic part:
        turning all of it into an opinionated Decision Stack.
      </Paragraph>
      <Paragraph style={{ margin: '0 0 8px' }}>Install in Claude Code:</Paragraph>
      <Section style={{ margin: '0 0 16px' }}>
        <div style={codeBlock}>
          claude plugin marketplace add lunastak/tools
          <br />
          claude plugin install lunastak@lunastak-tools
        </div>
      </Section>
      <Paragraph>
        Point it at a deck, a transcript, a half-finished memo. It organises the material, you import the bundle
        into Lunastak, and you can pick a session back up later with{' '}
        <code style={inlineCode}>/lunastak:resume</code>. Full setup, including Claude Desktop, Codex and Gemini, is
        at <Link href={installUrl} style={link}>lunastak.io/docs/install</Link>.
      </Paragraph>

      <Heading as="h3">It&rsquo;s not a black box.</Heading>
      <Paragraph>
        Most AI hands you an answer and hides the working. Lunastak shows it. Everything you feed in becomes a
        knowledgebase of insights, sorted by strategic dimension &mdash; and you can read it, search it, edit it, or
        bin what misses. That visible, editable layer is what your strategy is built on. So when something looks
        off, you fix it at the source instead of re-rolling and hoping.
      </Paragraph>
      {/* TODO: Knowledgebase / Evidence screenshot — drop Sanity URL into KB_SHOT below */}
      {KB_SHOT && (
        <Section style={{ margin: '4px 0 24px' }}>
          <Img src={`${KB_SHOT}?w=1120&fm=png&fit=max`} width="560" alt="Lunastak knowledgebase — editable insight fragments" style={screenshot} />
        </Section>
      )}

      <Heading as="h3">It reads like a human wrote it.</Heading>
      <Paragraph>
        Somewhere along the way I got hypersensitive to the tics in AI writing. Kinda allergic to them, honestly. So
        I&rsquo;ve been systematically designing them out of Lunastak. You can see it across the Acquired demos:
        I&rsquo;ve run Nike, Costco, TSMC and Ferrari through the pipeline, each one a full Decision Stack built from
        the episode transcript, all readable without signing in.{' '}
        <Link href={ferrariUrl} style={link}>Ferrari&rsquo;s</Link> the latest and the most plain-spoken. My
        favourite. FTW.
      </Paragraph>
      <Section style={{ margin: '4px 0 24px' }}>
        <Row>
          <Column style={logoCell}><Logo id={LOGOS.nike} alt="Nike" w={96} /></Column>
          <Column style={logoCell}><Logo id={LOGOS.costco} alt="Costco" w={96} /></Column>
          <Column style={logoCell}><Logo id={LOGOS.tsmc} alt="TSMC" w={96} /></Column>
          <Column style={logoCell}><Logo id={LOGOS.ferrari} alt="Ferrari" w={96} /></Column>
        </Row>
      </Section>
      <Paragraph>
        If you&rsquo;ve already got a stack in there, open it, hit refresh, and see what the sharper pipeline does
        with what you&rsquo;ve given it. If you don&rsquo;t,{' '}
        <Link href={ferrariUrl} style={link}>start with the Ferrari example</Link> and go from there.
      </Paragraph>

      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={openAppUrl}>Open Lunastak →</Button>
      </Section>

      <Paragraph>
        What do you wish Lunastak could do? Hit reply and tell me. There&rsquo;s more in flight, but I&rsquo;d
        rather build what you&rsquo;ll actually use.
      </Paragraph>

      <Paragraph>
        Cheers,
        <br />
        Jonny
      </Paragraph>

      <Divider />
      <Paragraph>
        PS — if you&rsquo;re curious why I&rsquo;m doing this, what I&rsquo;m learning, and where I think AI is
        heading, I&rsquo;m writing about it <Link href={insightsUrl} style={link}>here</Link>.
      </Paragraph>
    </>
  ),
}

export default broadcastContent
