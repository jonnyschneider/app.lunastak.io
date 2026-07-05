import Link from 'next/link'

export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lunastak-logo-mulberry.svg" alt="Lunastak" className="h-10 w-auto" />
      <h1 className="text-xl font-semibold">This link is no longer active</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The owner may have turned off sharing, or the link may be incorrect.
        Ask them for a fresh link — or build your own Decision Stack.
      </p>
      <Link
        href="/?utm_source=share_page&utm_medium=dead_link"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try Lunastak
      </Link>
    </div>
  )
}
