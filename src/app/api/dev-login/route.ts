import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  })

  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.set('next-auth.session-token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  })

  return response
}
