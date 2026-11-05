import prisma from '@/lib/prisma'
import { buildCaseReport } from '@/lib/case-report'
import { isSubjectSuppressed, loadApprovedSuppressionHashes } from '@/lib/subject-suppression'

export async function loadCaseReport(caseId: string, ownerId: string) {
  const caseData = await prisma.case.findFirst({
    where: { id: caseId, userId: ownerId },
    include: {
      subjects: {
        orderBy: { createdAt: 'asc' },
        include: {
          enrichmentResults: {
            include: {
              evidenceFacts: {
                orderBy: { retrievedAt: 'desc' },
              },
            },
          },
        },
      },
    },
  })

  if (!caseData) return null

  const approvedSuppressionHashes = await loadApprovedSuppressionHashes(caseData.subjects)
  const visibleSubjects = caseData.subjects.filter(
    subject => !isSubjectSuppressed(subject, approvedSuppressionHashes)
  )
  const suppressedSubjectCount = caseData.subjects.length - visibleSubjects.length

  const report = buildCaseReport({
    id: caseData.id,
    title: caseData.title,
    description: caseData.description,
    status: caseData.status,
    createdAt: caseData.createdAt,
    updatedAt: caseData.updatedAt,
    subjects: visibleSubjects.map(subject => ({
      id: subject.id,
      fullName: subject.fullName,
      phoneE164: subject.phoneE164,
      email: subject.email,
      username: subject.username,
      address: subject.address,
      city: subject.city,
      state: subject.state,
      notes: subject.notes,
      createdAt: subject.createdAt,
      evidenceFacts: subject.enrichmentResults.flatMap(result =>
        result.evidenceFacts.map(fact => ({
          id: fact.id,
          field: fact.field,
          value: fact.value,
          sourceName: fact.sourceName,
          sourceType: fact.sourceType,
          sourceUrl: fact.sourceUrl,
          sourceLocator: fact.sourceLocator,
          normalizedValue: fact.normalizedValue,
          rawRecordHash: fact.rawRecordHash,
          legalBasis: fact.legalBasis,
          retrievedAt: fact.retrievedAt,
          observedAt: fact.observedAt,
          confidenceScore: fact.confidenceScore,
          corroborationCount: fact.corroborationCount,
          conflictCount: fact.conflictCount,
        }))
      ),
    })),
  })

  return { report, suppressedSubjectCount }
}
