import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id

  const monitors = await prisma.subjectMonitor.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      subject: {
        select: {
          id: true,
          fullName: true,
          caseId: true,
          case: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
      checks: {
        orderBy: { checkedAt: 'desc' },
        take: 10,
      },
    },
  })

  return NextResponse.json({
    monitors,
    automaticProviderMonitoring: false,
    description:
      'Monitoring compares checkpoints of evidence already stored in AtlasVerify. It does not run providers in the background.',
  }, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
}
