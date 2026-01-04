export default function VerifyRequest() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md rounded-lg bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4 text-foreground">Check your email</h1>
        <p className="text-muted-foreground mb-4">
          A sign in link has been sent to your email address.
        </p>
        <p className="text-sm text-muted-foreground">
          Click the link in the email to sign in. You can close this tab.
        </p>
      </div>
    </div>
  )
}
