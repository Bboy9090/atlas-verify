import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const deleted = await prisma.user.deleteMany({ where: { id: userId } })
  if (deleted.count !== 1) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
