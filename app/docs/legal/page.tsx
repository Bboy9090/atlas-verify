import Link from 'next/link'
import { Shield, ArrowLeft, FileText, AlertTriangle, CheckCircle2, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function LegalDocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold text-white">AtlasVerify</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
            </Button>
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Legal Documentation</h1>
          <p className="text-slate-400 text-lg">
            Compliance-first approach to subject intelligence
          </p>
        </div>

        {/* Acceptable Use Policy */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-500" />
              Acceptable Use Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none">
            <p className="text-slate-300">Effective Date: June 2025</p>

            <h3 className="text-white mt-6">1. Purpose</h3>
            <p className="text-slate-300">
              AtlasVerify provides subject intelligence and verification services designed for lawful investigative purposes. 
              This Acceptable Use Policy ("AUP") outlines the terms under which our services may be used.
            </p>

            <h3 className="text-white mt-6">2. Permitted Uses</h3>
            <div className="space-y-2">
              {[
                'Public-record and public-web research for lawful purposes',
                'Reverse phone, email, address, username, business, and property research where lawful',
                'Identity verification and fraud prevention outside regulated eligibility decisions',
                'Personal due diligence, reconnecting, family-history, and authorized case research',
                'Legal or compliance research by authorized professionals'
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <h3 className="text-white mt-6">3. Prohibited Uses</h3>
            <div className="space-y-2">
              {[
                'Stalking, harassment, or intimidation of any individual',
                'Discrimination based on protected characteristics',
                'Any illegal surveillance or monitoring activities',
                'Circumventing data protection regulations',
                'Reselling or redistributing obtained data unless expressly licensed',
                'Employment, housing, credit, insurance, benefits, or other eligibility decisions requiring a regulated consumer report',
                'Any use violating applicable local, state, or federal laws'
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <h3 className="text-white mt-6">4. User Responsibilities</h3>
            <p className="text-slate-300">
              AtlasVerify's standard product is not a consumer reporting agency and must not be used for
              employment, tenant, credit, insurance, government-benefit, or other regulated eligibility
              decisions. Users are responsible for lawful purpose, provider terms, consent where required,
              and applicable privacy laws.
            </p>

            <h3 className="text-white mt-6">5. Enforcement</h3>
            <p className="text-slate-300">
              Violation of this AUP may result in immediate suspension or termination of services, 
              without refund. We reserve the right to report suspected illegal activities to appropriate authorities.
            </p>
          </CardContent>
        </Card>

        {/* Opt-Out Process */}
        <Card id="opt-out" className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <UserX className="h-6 w-6 text-blue-500" />
              Opt-Out Process
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none">
            <p className="text-slate-300">Effective Date: June 2025</p>

            <h3 className="text-white mt-6">Subject Rights</h3>
            <p className="text-slate-300">
              AtlasVerify respects the privacy rights of individuals. If you believe your information
              appears in AtlasVerify-controlled search results or indexes and wish to request suppression,
              you may submit a request using the process below.
            </p>

            <h3 className="text-white mt-6">How to Submit an Opt-Out Request</h3>
            <div className="bg-slate-900/50 rounded-lg p-6 mt-4">
              <ol className="list-decimal list-inside space-y-3 text-slate-300">
                <li>
                  <strong>Email Request:</strong> Send an email to <span className="text-blue-400">privacy@atlasverify.example.com</span> with the subject line "Opt-Out Request"
                </li>
                <li>
                  <strong>Required Information:</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Name or identifier shown in the relevant AtlasVerify record</li>
                    <li>A current contact method so we can respond to the request</li>
                    <li>Enough information to identify the specific record or result to suppress</li>
                    <li>Additional verification only when necessary, using the least intrusive reasonable method</li>
                  </ul>
                </li>
                <li>
                  <strong>Verification:</strong> We will use data-minimizing verification and will not require government ID by default
                </li>
                <li>
                  <strong>Processing:</strong> Upon verification, we will process your opt-out within 30 days
                </li>
              </ol>
            </div>

            <h3 className="text-white mt-6">What Opt-Out Covers</h3>
            <p className="text-slate-300">
              Upon successful opt-out, your information will be suppressed from future enrichment queries. 
              Note that opt-out does not retroactively remove data from completed investigations, 
              as investigators may be required to retain such records for legal compliance.
            </p>

            <h3 className="text-white mt-6">Exceptions</h3>
            <p className="text-slate-300">
              Opt-out may not apply to investigations required by law enforcement, court orders, 
              or other legal processes. We will notify you if your request cannot be honored due to legal requirements.
            </p>

            <h3 className="text-white mt-6">Contact Information</h3>
            <div className="bg-slate-900/50 rounded-lg p-6 mt-4 text-slate-300">
              <p className="font-semibold text-white">AtlasVerify Privacy Office</p>
              <p>Email: privacy@atlasverify.example.com</p>
              <p>Response Time: Within 10 business days</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-slate-700 mt-12">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Shield className="h-5 w-5 text-blue-500" />
          <span>© 2025 AtlasVerify. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
