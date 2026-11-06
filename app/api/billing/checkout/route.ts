import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { billingBaseUrl, configuredStripePriceId, stripeRequest } from '@/lib/stripe-billing'

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email

  if (!userId || !email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const priceId = configuredStripePriceId()
  if (!priceId || !process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const billing = await prisma.billingAccount.findUnique({ where: { userId } })
  const baseUrl = billingBaseUrl()
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: userId,
    customer_email: email,
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/dashboard?billing=cancelled`,
    'subscription_data[metadata][atlas_user_id]': userId,
    'metadata[atlas_user_id]': userId,
    allow_promotion_codes: 'true',
  })

  if (billing?.stripeCustomerId) {
    params.delete('customer_email')
    params.set('customer', billing.stripeCustomerId)
  }

  try {
    const checkoutSession = await stripeRequest('/checkout/sessions', params)
    const url = typeof checkoutSession.url === 'string' ? checkoutSession.url : null
    if (!url) throw new Error('Stripe Checkout did not return a URL')
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Stripe checkout creation failed:', error)
    return NextResponse.json({ error: 'Unable to start checkout' }, { status: 502 })
  }
}
