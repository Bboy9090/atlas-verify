export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-200">
      <h1 className="text-3xl font-semibold text-white">Bobby's Case File Support</h1>
      <p>
        For technical issues, record the application version, browser/OS, affected workflow, and
        a redacted error message. Do not attach private subject records, credentials, API keys, or
        unredacted evidence to public support requests.
      </p>
      <p>
        Review the <a className="text-blue-400 underline" href="/docs/legal">Acceptable Use and Opt-Out documentation</a> before
        using investigative or enrichment features.
      </p>
      <p>
        Repository support: <a className="text-blue-400 underline" href="https://github.com/Bboy9090/atlas-verify/issues">GitHub issues</a>.
      </p>
    </main>
  )
}
