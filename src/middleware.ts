import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

/**
 * Demo slug rewrites: /demo/<slug>[/...] → /project/<projectId>[/...]
 *
 * The URL stays as /demo/<slug> in the browser. Rewrites are runtime so
 * adding/changing a demo only requires setting Project.demoSlug in the DB —
 * no deploy.
 *
 * Uses @neondatabase/serverless directly (not prisma) to keep the edge
 * bundle small. The full Prisma client is too heavy to ship to Edge.
 */
export async function middleware(req: NextRequest) {
  const match = req.nextUrl.pathname.match(/^\/demo\/([^/]+)(\/.*)?$/)
  if (!match) return NextResponse.next()

  const slug = match[1]
  const rest = match[2] || ''

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const rows = (await sql`
      SELECT id FROM "Project"
      WHERE "demoSlug" = ${slug} AND "isDemo" = true AND status = 'active'
      LIMIT 1
    `) as Array<{ id: string }>

    if (rows.length === 0) {
      return NextResponse.rewrite(new URL('/404', req.url))
    }

    const url = req.nextUrl.clone()
    url.pathname = `/project/${rows[0].id}${rest}`
    return NextResponse.rewrite(url)
  } catch (err) {
    console.error('demo-slug middleware error:', err)
    return NextResponse.rewrite(new URL('/404', req.url))
  }
}

export const config = {
  matcher: '/demo/:path*',
}
