import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { stripeId, verifyStripeWebhook } from '@/lib/stripe-billing'

type StripeEvent = {
  id?: string
  type?: string
  data?: { object?: Record<string, unknown> }
}

function unixDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

  try {
    verifyStripeWebhook(rawBody, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const object = event.data?.object
  if (!event.type || !object) return NextResponse.json({ received: true })

  try {
    if (event.type === 'checkout.session.completed') {
      const userId = typeof object.client_reference_id === 'string'
        ? object.client_reference_id
        : typeof (object.metadata as Record<string, unknown> | undefined)?.atlas_user_id === 'string'
          ? String((object.metadata as Record<string, unknown>).atlas_user_id)
          : null

      if (userId) {
        const customerId = stripeId(object.customer)
        const subscriptionId = stripeId(object.subscription)
        await prisma.billingAccount.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: process.env.STRIPE_PRICE_ID?.trim() || null,
            status: 'checkout_complete',
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: process.env.STRIPE_PRICE_ID?.trim() || undefined,
            status: 'checkout_complete',
          },
        })
      }
    }

    if (event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted') {
      const subscriptionId = stripeId(object.id)
      const customerId = stripeId(object.customer)
      const metadata = object.metadata as Record<string, unknown> | undefined
      const metadataUserId = typeof metadata?.atlas_user_id === 'string' ? metadata.atlas_user_id : null
      const items = object.items as { data?: Array<{ price?: { id?: unknown } }> } | undefined
      const priceId = stripeId(items?.data?.[0]?.price?.id)
      const status = typeof object.status === 'string' ? object.status : 'unknown'
      const currentPeriodEnd = unixDate(object.current_period_end)
      const cancelAtPeriodEnd = object.cancel_at_period_end === true

      if (metadataUserId) {
        await prisma.billingAccount.upsert({
          where: { userId: metadataUserId },
          create: {
            userId: metadataUserId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd,
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd,
          },
        })
      } else if (subscriptionId || customerId) {
        await prisma.billingAccount.updateMany({
          where: subscriptionId
            ? { stripeSubscriptionId: subscriptionId }
            : { stripeCustomerId: customerId! },
          data: {
            stripeSubscriptionId: subscriptionId || undefined,
            stripePriceId: priceId || undefined,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd,
          },
        })
      }
    }
  } catch (error) {
    console.error('Stripe webhook reconciliation failed:', { eventId: event.id, type: event.type, error })
    return NextResponse.json({ error: 'Webhook reconciliation failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

export const runtime = 'nodejs'
