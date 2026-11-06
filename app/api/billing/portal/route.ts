import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { billingBaseUrl, stripeRequest } from '@/lib/stripe-billing'

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const billing = await prisma.billingAccount.findUnique({ where: { userId } })
  if (!billing?.stripeCustomerId || !process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: 'No billing customer is available' }, { status: 409 })
  }

  try {
    const session = await stripeRequest('/billing_portal/sessions', new URLSearchParams({
      customer: billing.stripeCustomerId,
      return_url: `${billingBaseUrl()}/dashboard`,
    }))
    const url = typeof session.url === 'string' ? session.url : null
    if (!url) throw new Error('Stripe Billing Portal did not return a URL')
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Stripe portal creation failed:', error)
    return NextResponse.json({ error: 'Unable to open billing portal' }, { status: 502 })
  }
}
