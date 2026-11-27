import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllProviders } from '@/providers'

// GET available enrichment providers
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store, private' } })
  try {
    const providers = getAllProviders().map(p => ({
      name: p.name,
      type: p.type,
      sourcePolicy: p.sourcePolicy,
      verification: 'not_tested'
    }))

    return NextResponse.json({ providers, liveVerificationPerformed: false }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Error fetching providers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
