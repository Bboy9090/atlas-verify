export interface SecBusinessCandidate {
  cik: string
  name: string | null
  ticker?: string | null
  stateOfIncorporation?: string | null
  sourceUrl?: string | null
}

export interface RegistryBusinessCandidate {
  name: string | null
  companyNumber: string | null
  jurisdictionCode: string | null
  currentStatus?: string | null
  sourceUrl?: string | null
}

export interface BusinessCorrelation {
  name: string
  secCik: string
  registryCompanyNumber: string | null
  registryJurisdiction: string | null
  secJurisdiction: string | null
  sourceCount: 2
  jurisdictionAgreement: boolean | null
  confidence: number
  identityConfirmed: false
  rationale: string[]
}

export function normalizeBusinessName(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeJurisdiction(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/-/g, '_')
  if (/^us_[a-z]{2}$/.test(normalized)) return normalized.slice(3).toUpperCase()
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase()
  return normalized.toUpperCase()
}

export function correlateBusinessCandidates(
  sec: SecBusinessCandidate[],
  registry: RegistryBusinessCandidate[],
): BusinessCorrelation[] {
  const results: BusinessCorrelation[] = []

  for (const secEntity of sec) {
    const secName = normalizeBusinessName(secEntity.name)
    if (!secName) continue

    const secJurisdiction = normalizeJurisdiction(secEntity.stateOfIncorporation)

    for (const registryEntity of registry) {
      const registryName = normalizeBusinessName(registryEntity.name)
      if (!registryName || registryName !== secName) continue

      const registryJurisdiction = normalizeJurisdiction(registryEntity.jurisdictionCode)
      const jurisdictionAgreement =
        secJurisdiction && registryJurisdiction
          ? secJurisdiction === registryJurisdiction
          : null

      const rationale = ['Exact normalized company name appears in both SEC EDGAR and OpenCorporates.']
      let confidence = 0.74

      if (jurisdictionAgreement === true) {
        confidence = 0.9
        rationale.push('Jurisdiction also agrees across both sources.')
      } else if (jurisdictionAgreement === false) {
        confidence = 0.58
        rationale.push('Jurisdiction conflicts across sources; manual review required.')
      } else {
        rationale.push('Jurisdiction could not be compared from both sources.')
      }

      results.push({
        name: secEntity.name || registryEntity.name || secName,
        secCik: secEntity.cik,
        registryCompanyNumber: registryEntity.companyNumber,
        registryJurisdiction: registryEntity.jurisdictionCode,
        secJurisdiction: secEntity.stateOfIncorporation ?? null,
        sourceCount: 2,
        jurisdictionAgreement,
        confidence,
        identityConfirmed: false,
        rationale,
      })
    }
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)
}
