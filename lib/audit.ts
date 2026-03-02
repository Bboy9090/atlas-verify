import prisma from './prisma'
import type { AuditAction } from '@/types'

export async function createAuditLog(
  userId: string,
  action: AuditAction,
  metadata: Record<string, unknown>,
  subjectId?: string
) {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      subjectId,
      metadata
    }
  })
}
