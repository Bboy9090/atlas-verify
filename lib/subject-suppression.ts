import prisma from '@/lib/prisma'
import {
  hashSuppressionIdentifier,
  type SuppressionIdentifierType,
} from '@/lib/suppression'

export interface SuppressibleSubject {
  fullName: string
  phoneE164?: string | null
  email?: string | null
  address?: string | null
  username?: string | null
}

const identifierPairs = (subject: SuppressibleSubject): Array<[SuppressionIdentifierType, string]> => {
  const values: Array<[SuppressionIdentifierType, string | null | undefined]> = [
    ['name', subject.fullName],
    ['phone', subject.phoneE164],
    ['email', subject.email],
    ['address', subject.address],
    ['username', subject.username],
  ]

  return values.filter(
    (entry): entry is [SuppressionIdentifierType, string] => Boolean(entry[1]?.trim())
  )
}

export function suppressionHashesForSubject(subject: SuppressibleSubject): string[] {
  return identifierPairs(subject).map(([type, value]) =>
    hashSuppressionIdentifier(type, value)
  )
}

export async function loadApprovedSuppressionHashes(
  subjects: SuppressibleSubject[]
): Promise<Set<string>> {
  const hashes = Array.from(
    new Set(subjects.flatMap(subject => suppressionHashesForSubject(subject)))
  )

  if (hashes.length === 0) return new Set()

  const records = await prisma.suppressionRequest.findMany({
    where: {
      status: 'approved',
      identifierHash: { in: hashes },
    },
    select: { identifierHash: true },
  })

  return new Set(records.map(record => record.identifierHash))
}

export function isSubjectSuppressed(
  subject: SuppressibleSubject,
  approvedHashes: ReadonlySet<string>
): boolean {
  return suppressionHashesForSubject(subject).some(hash => approvedHashes.has(hash))
}
