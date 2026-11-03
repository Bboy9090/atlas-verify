export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-200">
      <h1 className="text-3xl font-semibold text-white">AtlasVerify Privacy</h1>
      <p className="text-sm text-slate-400">Last updated: October 31, 2026</p>
      <p>
        AtlasVerify is designed for lawful consumer/public-record research, evidence management, and verification workflows.
        Depending on the features you use, the service can store account information, cases,
        subjects, enrichment results, notes, and audit records that you or authorized data
        providers supply.
      </p>
      <h2 className="text-xl font-semibold text-white">Sensitive investigation data</h2>
      <p>
        Do not submit information you are not authorized to process. Case and subject data is not
        included in the PWA offline cache. The service worker caches only public application
        assets such as icons, the manifest, and the offline notice.
      </p>
      <h2 className="text-xl font-semibold text-white">Authentication and providers</h2>
      <p>
        AtlasVerify uses authenticated server-side services and may use configured enrichment
        providers. Provider-specific processing and retention are governed by the deployment and
        provider configuration selected by the operator.
      </p>
      <h2 className="text-xl font-semibold text-white">Auditability and controls</h2>
      <p>
        AtlasVerify maintains audit-oriented records for supported actions. Users remain
        responsible for lawful purpose, consent where required, access control, and compliance
        with applicable privacy rules. AtlasVerify's standard product is not a consumer reporting agency
        and must not be used for regulated employment, housing, credit, insurance, or similar eligibility decisions.
      </p>
      <h2 className="text-xl font-semibold text-white">Questions and opt-out</h2>
      <p>
        Review the Acceptable Use and Opt-Out materials under <a className="text-blue-400 underline" href="/docs/legal">Legal</a>.
        Suppression requests should use the minimum information necessary to identify the relevant record;
        government ID should not be required by default. Deployment-specific privacy requests should be directed
        to the operator of the AtlasVerify instance.
      </p>
    </main>
  )
}
