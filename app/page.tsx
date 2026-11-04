'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, ArrowRight, CheckCircle2, Search, Users, FileText, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold text-white">Bobby&apos;s Case File</span>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" className="min-h-11 text-slate-300 hover:text-white">
              <Link href="/docs/legal">Legal</Link>
            </Button>
            <Button asChild variant="ghost" className="min-h-11 text-slate-300 hover:text-white">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }} className="min-h-11 hover:opacity-90">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          People Search & Evidence
          <span className="block text-blue-500">Made Traceable</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          Search lawful public records, connect evidence to cases, and see where every result came from. Built for provenance, corrections, and compliance-first research.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg" style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }} className="min-h-11 hover:opacity-90">
            <Link href="/register">
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-11 border-slate-600 text-slate-300 hover:bg-slate-800">
            <Link href="/docs/legal">View Legal Docs</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <FileText className="h-12 w-12 text-blue-500 mb-4" />
              <CardTitle className="text-white">Case Management</CardTitle>
              <CardDescription className="text-slate-400">
                Organize investigations with structured case files and comprehensive subject tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {['Create & manage case files', 'Add multiple subjects', 'Track investigation progress'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Search className="h-12 w-12 text-blue-500 mb-4" />
              <CardTitle className="text-white">Data Enrichment</CardTitle>
              <CardDescription className="text-slate-400">
                Automated enrichment pipelines for phone lookup and web search providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {['Phone number verification', 'Web presence search', 'Confidence scoring'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Users className="h-12 w-12 text-blue-500 mb-4" />
              <CardTitle className="text-white">Audit & Compliance</CardTitle>
              <CardDescription className="text-slate-400">
                Complete audit trail for every action with compliance-ready documentation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {['Full audit logging', 'User action tracking', 'Opt-out management'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-slate-700">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-semibold text-white">Bobby&apos;s Case File</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-400">
            <Link href="/privacy" className="inline-flex min-h-11 items-center rounded px-2 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/support" className="inline-flex min-h-11 items-center rounded px-2 hover:text-white transition-colors">
              Support
            </Link>
            <Link href="/docs/legal" className="inline-flex min-h-11 items-center rounded px-2 hover:text-white transition-colors">
              Acceptable Use Policy
            </Link>
            <Link href="/docs/legal#opt-out" className="inline-flex min-h-11 items-center rounded px-2 hover:text-white transition-colors">
              Opt-Out Process
            </Link>
          </div>
          <p className="text-slate-500 text-sm">
            © 2026 Bobby's Workshop. Bobby's Case File.
          </p>
        </div>
      </footer>
    </div>
  )
}
