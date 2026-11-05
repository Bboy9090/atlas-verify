export interface NhtsaComplaintRecord {
  odiNumber: string | null
  manufacturer: string | null
  components: string | null
  summary: string | null
  dateOfIncident: string | null
  crash: boolean | null
  fire: boolean | null
  injuries: number | null
  deaths: number | null
}

interface ComplaintResponse {
  results?: Array<Record<string, unknown>>
  Results?: Array<Record<string, unknown>>
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') return true
    if (normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '0') return false
  }
  return null
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function normalizeNhtsaComplaint(row: Record<string, unknown>): NhtsaComplaintRecord {
  return {
    odiNumber: text(row.odiNumber ?? row.ODINumber ?? row.ODI_NUMBER),
    manufacturer: text(row.manufacturer ?? row.Manufacturer),
    components: text(row.components ?? row.Components ?? row.component ?? row.Component),
    summary: text(row.summary ?? row.Summary),
    dateOfIncident: text(row.dateOfIncident ?? row.DateOfIncident),
    crash: bool(row.crash ?? row.Crash),
    fire: bool(row.fire ?? row.Fire),
    injuries: numberValue(row.numberOfInjuries ?? row.NumberOfInjuries ?? row.injuries),
    deaths: numberValue(row.numberOfDeaths ?? row.NumberOfDeaths ?? row.deaths),
  }
}

export async function lookupNhtsaModelComplaints(
  make: string,
  model: string,
  modelYear: string,
): Promise<{ records: NhtsaComplaintRecord[]; sourceUrl: string }> {
  const url = new URL('https://api.nhtsa.gov/complaints/complaintsByVehicle')
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
    if (!response.ok) throw new Error(`NHTSA complaints returned HTTP ${response.status}.`)

    const body = await response.json() as ComplaintResponse
    const rows = body.results ?? body.Results ?? []
    return {
      records: rows.slice(0, 50).map(normalizeNhtsaComplaint),
      sourceUrl: url.toString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}
