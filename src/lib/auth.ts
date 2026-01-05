import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { resend, EMAIL_CONFIG } from "@/lib/resend"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: "", // Not needed for Resend
      from: EMAIL_CONFIG.from,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
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
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
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
