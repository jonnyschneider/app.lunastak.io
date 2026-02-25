import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { resend, EMAIL_CONFIG } from "@/lib/resend"
import { notifySlackNewUser } from "@/lib/notifications"
import { transferGuestToUser } from "@/lib/transfer-session"

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
        const { data, error } = await resend.emails.send({
          from: EMAIL_CONFIG.from,
          replyTo: EMAIL_CONFIG.replyTo,
          to: email,
          subject: "Sign in to Lunastak",
          html: `
            <p>Click the link below to sign in:</p>
            <a href="${url}">Sign in to Lunastak</a>
            <p>If you did not request this email, you can safely ignore it.</p>
          `,
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
    createUser: async ({ user }) => {
      // Notify Slack of new signup
      if (user.email) {
        notifySlackNewUser(user.email)
      }
      // Note: We no longer seed demo projects on signup.
      // New users get an empty project, with "See an example" available on-demand.
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Server-side fallback: check for pending guest transfer
      // This handles cross-browser magic link flows where the cookie is lost
      if (user.id && user.email) {
        try {
          const pending = await prisma.pendingGuestTransfer.findFirst({
            where: { email: user.email.toLowerCase() },
          })

          if (pending) {
            console.log(`[Auth] Found pending transfer for ${user.email}: guest ${pending.guestUserId}`)
            await transferGuestToUser(pending.guestUserId, user.id)

            // Clean up this pending transfer
            await prisma.pendingGuestTransfer.delete({
              where: { id: pending.id },
            })
          }

          // Clean up stale pending transfers (older than 24h)
          await prisma.pendingGuestTransfer.deleteMany({
            where: {
              createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          })
        } catch (error) {
          // Don't block sign-in on transfer failure
          console.error('[Auth] Pending transfer failed:', error)
        }
      }
      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
}
