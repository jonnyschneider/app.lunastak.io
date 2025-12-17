import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: "", // Not needed for Resend
      from: process.env.RESEND_FROM_EMAIL,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject: "Sign in to Decision Stack",
          html: `
            <p>Click the link below to sign in:</p>
            <a href="${url}">Sign in to Decision Stack</a>
            <p>If you did not request this email, you can safely ignore it.</p>
          `,
        })
      },
    }),
  ],
  pages: {
    signIn: "/", // Keep users on main page
    verifyRequest: "/", // Stay on main page after email sent
    error: "/", // Stay on main page on error
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
