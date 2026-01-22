import { jwtVerify } from 'jose'

const getSecret = () => {
  const secret = process.env.MAGIC_LINK_SECRET
  if (!secret) {
    throw new Error('MAGIC_LINK_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

export async function verifyMagicLinkToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (typeof payload.email === 'string') {
      return { email: payload.email }
    }
    return null
  } catch {
    return null
  }
}
