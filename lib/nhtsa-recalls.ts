export interface NhtsaRecallRecord {
  campaignNumber: string | null
  manufacturer: string | null
  component: string | null
  summary: string | null
  consequence: string | null
  remedy: string | null
  reportReceivedDate: string | null
  parkIt: boolean | null
  parkOutside: boolean | null
  overTheAirUpdate: boolean | null
}

interface NhtsaRecallResponse {
  results?: Array<Record<string, unknown>>
  Results?: Array<Record<string, unknown>>
  count?: number
  Count?: number
  message?: string
  Message?: string
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true
    if (normalized === 'false' || normalized === 'no' || normalized === '0') return false
  }
  return null
}

export function normalizeNhtsaRecall(row: Record<string, unknown>): NhtsaRecallRecord {
  return {
    campaignNumber: text(row.NHTSACampaignNumber ?? row.nhtsaCampaignNumber),
    manufacturer: text(row.Manufacturer ?? row.manufacturer),
    component: text(row.Component ?? row.component),
    summary: text(row.Summary ?? row.summary),
    consequence: text(row.Consequence ?? row.consequence),
    remedy: text(row.Remedy ?? row.remedy),
    reportReceivedDate: text(row.ReportReceivedDate ?? row.reportReceivedDate),
    parkIt: bool(row.parkIt ?? row.ParkIt),
    parkOutside: bool(row.parkOutSide ?? row.parkOutside ?? row.ParkOutside),
    overTheAirUpdate: bool(row.overTheAirUpdate ?? row.OverTheAirUpdate),
  }
}

export async function lookupNhtsaModelRecalls(
  make: string,
  model: string,
  modelYear: string,
): Promise<{
  records: NhtsaRecallRecord[]
  sourceUrl: string
  message: string | null
}> {
  const url = new URL('https://api.nhtsa.gov/recalls/recallsByVehicle')
  url.searchParams.set('make', make)
  url.searchParams.set('model', model)
  url.searchParams.set('modelYear', modelYear)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AtlasVerify/1.0 (+single-query-vehicle-safety-research)',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`NHTSA recalls returned HTTP ${response.status}.`)
    }

    const body = await response.json() as NhtsaRecallResponse
    const rows = body.results ?? body.Results ?? []
    return {
      records: rows.slice(0, 100).map(normalizeNhtsaRecall),
      sourceUrl: url.toString(),
      message: text(body.message ?? body.Message),
    }
  } finally {
    clearTimeout(timeout)
  }
}
