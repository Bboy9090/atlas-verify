import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>
}

// GET single subject
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id: caseId, subjectId } = await params

    // Check case ownership
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, userId }
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, caseId },
      include: {
        enrichmentResults: {
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    return NextResponse.json(subject)
  } catch (error) {
    console.error('Error fetching subject:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update subject
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id: caseId, subjectId } = await params
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    // Check case ownership
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, userId }
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, caseId }
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    const body = await request.json()
    const { fullName, phoneE164, email, address, city, state, notes } = body

    const updatedSubject = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        fullName: fullName || subject.fullName,
        phoneE164: phoneE164 !== undefined ? phoneE164 : subject.phoneE164,
        email: email !== undefined ? email : subject.email,
        address: address !== undefined ? address : subject.address,
        city: city !== undefined ? city : subject.city,
        state: state !== undefined ? state : subject.state,
        notes: notes !== undefined ? notes : subject.notes
      }
    })

    // Create audit log
    await createAuditLog(userId, 'UPDATE_SUBJECT', {
      subjectId,
      caseId,
      changes: body
    }, subjectId)

    return NextResponse.json(updatedSubject)
  } catch (error) {
    console.error('Error updating subject:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE subject
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id: caseId, subjectId } = await params

    // Check case ownership
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, userId }
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, caseId }
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    await prisma.subject.delete({ where: { id: subjectId } })

    // Create audit log
    await createAuditLog(userId, 'DELETE_SUBJECT', {
      subjectId,
      caseId,
      fullName: subject.fullName
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subject:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
