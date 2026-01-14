import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { resend, EMAIL_CONFIG } from "@/lib/resend"
import { seedDemoProject } from "@/lib/seed-demo"

async function notifySlackNewUser(email: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎉 New user signed up: ${email}`,
      }),
    })
  } catch (err) {
    console.error('[Slack] Failed to send notification:', err)
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
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
    }),
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

      // Seed demo project for new users
      await seedDemoProject(user.id).catch((err) =>
        console.error('Failed to seed demo project:', err)
      );
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
