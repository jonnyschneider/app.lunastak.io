export default function VerifyRequest() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="max-w-md rounded-lg bg-white dark:bg-zinc-800 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-white">Check your email</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          A sign in link has been sent to your email address.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Click the link in the email to sign in. You can close this tab.
        </p>
      </div>
    </div>
  )
}
