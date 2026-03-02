import { NextResponse } from 'next/server'
import { getAllProviders } from '@/providers'

// GET available enrichment providers
export async function GET() {
  try {
    const providers = getAllProviders().map(p => ({
      name: p.name,
      type: p.type
    }))

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('Error fetching providers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
