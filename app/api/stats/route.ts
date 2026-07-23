import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

// GET stats for current user's dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const rateLimit = checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    const [
      totalCases,
      openCases,
      inProgressCases,
      closedCases,
      totalSubjects,
      totalEnrichments,
      recentActivity,
      enrichmentsByProvider,
    ] = await Promise.all([
      prisma.case.count({ where: { userId } }),
      prisma.case.count({ where: { userId, status: 'open' } }),
      prisma.case.count({ where: { userId, status: 'in-progress' } }),
      prisma.case.count({ where: { userId, status: 'closed' } }),
      prisma.subject.count({
        where: { case: { userId } }
      }),
      prisma.enrichmentResult.count({
        where: { subject: { case: { userId } } }
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { subject: { select: { fullName: true } } }
      }),
      prisma.enrichmentResult.groupBy({
        by: ['provider'],
        where: { subject: { case: { userId } } },
        _count: { id: true },
        _avg: { confidenceScore: true },
      }),
    ])

    return NextResponse.json({
      cases: {
        total: totalCases,
        open: openCases,
        inProgress: inProgressCases,
        closed: closedCases,
      },
      subjects: { total: totalSubjects },
      enrichments: {
        total: totalEnrichments,
        byProvider: enrichmentsByProvider.map(p => ({
          provider: p.provider,
          count: p._count.id,
          avgConfidence: p._avg.confidenceScore ?? 0,
        })),
      },
      recentActivity,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
