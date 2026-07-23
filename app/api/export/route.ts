import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',')
}

// GET /api/export?type=cases|subjects&caseId=<id>
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'cases'
    const caseId = searchParams.get('caseId')

    if (type === 'cases') {
      const cases = await prisma.case.findMany({
        where: { userId },
        include: { _count: { select: { subjects: true } } },
        orderBy: { createdAt: 'desc' },
      })

      const header = rowToCsv(['ID', 'Title', 'Description', 'Status', 'Subjects', 'Created At', 'Updated At'])
      const rows = cases.map(c =>
        rowToCsv([c.id, c.title, c.description, c.status, c._count.subjects, c.createdAt.toISOString(), c.updatedAt.toISOString()])
      )
      const csv = [header, ...rows].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="cases.csv"',
        },
      })
    }

    if (type === 'subjects') {
      const whereCase = caseId
        ? { id: caseId, userId }
        : { userId }

      // Verify ownership when filtering by case
      if (caseId) {
        const caseData = await prisma.case.findFirst({ where: { id: caseId, userId } })
        if (!caseData) {
          return NextResponse.json({ error: 'Case not found' }, { status: 404 })
        }
      }

      const subjects = await prisma.subject.findMany({
        where: { case: whereCase },
        include: {
          case: { select: { title: true } },
          _count: { select: { enrichmentResults: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const header = rowToCsv([
        'ID', 'Full Name', 'Phone', 'Email', 'Address', 'City', 'State',
        'Notes', 'Case', 'Enrichments', 'Created At',
      ])
      const rows = subjects.map(s =>
        rowToCsv([
          s.id, s.fullName, s.phoneE164, s.email, s.address, s.city, s.state,
          s.notes, s.case.title, s._count.enrichmentResults, s.createdAt.toISOString(),
        ])
      )
      const csv = [header, ...rows].join('\n')

      const filename = caseId ? `subjects-${caseId}.csv` : 'subjects.csv'
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid export type. Use type=cases or type=subjects' }, { status: 400 })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
