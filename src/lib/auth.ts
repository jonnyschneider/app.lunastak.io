import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { resend, EMAIL_CONFIG } from "@/lib/resend"
import { renderEmail } from "@/lib/render-email"
import { MagicLinkEmail } from "@/emails/transactional/magic-link"
import { onSignup, onSignIn } from "@/lib/signup-orchestrator"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: "", // Not needed for Resend
      from: EMAIL_CONFIG.from,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const html = await renderEmail(MagicLinkEmail({ signInUrl: url }))
        const { data, error } = await resend.emails.send({
          from: EMAIL_CONFIG.from,
          replyTo: EMAIL_CONFIG.replyTo,
          to: email,
          subject: "Sign in to Lunastak",
          html,
        })

        if (error) {
          console.error('[Auth] Failed to send verification email:', error)
          throw new Error(`Failed to send email: ${error.message}`)
        }

        console.log('[Auth] Verification email sent:', data?.id)
      },
      // Allow email sign-in to link to existing accounts (e.g., Google)
      // Type missing in next-auth@4 but option is valid at runtime
      allowDangerousEmailAccountLinking: true,
    } as Parameters<typeof EmailProvider>[0] & { allowDangerousEmailAccountLinking?: boolean }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
  },
  events: {
    signIn: async ({ user, account, isNewUser }) => {
      if (!user.id || !user.email) return

      const rawProvider = account?.provider as 'google' | 'email' | undefined
      const provider = rawProvider ?? 'email'

      if (isNewUser) {
        await onSignup({
          userId: user.id,
          email: user.email,
          name: user.name ?? undefined,
          provider,
          source: 'nextauth',
        })
      }

      await onSignIn({
        userId: user.id,
        email: user.email,
        isNewUser: !!isNewUser,
        provider,
      })
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
}
