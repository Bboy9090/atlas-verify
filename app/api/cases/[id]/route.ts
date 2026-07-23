import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET single case with subjects
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id } = await params

    const caseData = await prisma.case.findFirst({
      where: { id, userId },
      include: {
        subjects: {
          include: {
            enrichmentResults: {
              orderBy: { timestamp: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    return NextResponse.json(caseData)
  } catch (error) {
    console.error('Error fetching case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update case
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id } = await params
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    // Check ownership
    const existingCase = await prisma.case.findFirst({
      where: { id, userId }
    })

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status } = body

    const validStatuses = ['open', 'in-progress', 'closed']
    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        title: title || existingCase.title,
        description: description !== undefined ? description : existingCase.description,
        status: status && validStatuses.includes(status) ? status : existingCase.status,
      }
    })

    // Create audit log
    await createAuditLog(userId, 'UPDATE_CASE', {
      caseId: id,
      changes: { title, description }
    })

    return NextResponse.json(updatedCase)
  } catch (error) {
    console.error('Error updating case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE case
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id } = await params

    // Check ownership
    const existingCase = await prisma.case.findFirst({
      where: { id, userId }
    })

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    await prisma.case.delete({ where: { id } })

    // Create audit log
    await createAuditLog(userId, 'DELETE_CASE', {
      caseId: id,
      title: existingCase.title
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
