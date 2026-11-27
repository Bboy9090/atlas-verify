import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { configurationState, summarizeConfiguration } from '@/lib/provider-readiness'

type IntegrationStatus = 'configured' | 'missing_configuration' | 'public_no_key'

interface IntegrationReadiness {
  id: string
  label: string
  status: IntegrationStatus
  verification: 'not_tested'
  requiredVariables: string[]
  missingVariables: string[]
  coverage: string
  sourceKind: 'licensed_api' | 'public_web' | 'public_record'
}

function item(
  id: string,
  label: string,
  requiredVariables: string[],
  coverage: string,
  sourceKind: IntegrationReadiness['sourceKind'],
): IntegrationReadiness {
  return { id, label, requiredVariables, coverage, sourceKind, ...configurationState(requiredVariables, process.env) }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integrations: IntegrationReadiness[] = [
    item(
      'twilio_phone',
      'Twilio phone intelligence',
      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
      'Phone validation, carrier, and line type.',
      'licensed_api',
    ),
    item(
      'brave_search',
      'Brave public-web discovery',
      ['BRAVE_SEARCH_API_KEY'],
      'Public-web and public-profile candidate discovery.',
      'public_web',
    ),
    item(
      'enformion_people',
      'Enformion people search',
      ['ENFORMION_AP_NAME', 'ENFORMION_AP_PASSWORD'],
      'Licensed people-search candidate data.',
      'licensed_api',
    ),
    item(
      'sec_edgar',
      'SEC EDGAR',
      ['SEC_USER_AGENT'],
      'U.S. public-company filings and business entity leads.',
      'public_record',
    ),
    item(
      'opencorporates',
      'OpenCorporates',
      ['OPENCORPORATES_API_TOKEN'],
      'Broader company and officer registry candidates.',
      'licensed_api',
    ),
    item(
      'attom_property',
      'ATTOM property data',
      ['ATTOM_API_KEY'],
      'Licensed nationwide U.S. property depth; county coverage varies.',
      'licensed_api',
    ),
    item(
      'courtlistener',
      'CourtListener / RECAP',
      ['COURTLISTENER_API_TOKEN'],
      'Federal and participating court-record search leads.',
      'public_record',
    ),
    item(
      'courtlistener_bankruptcy',
      'CourtListener / RECAP Bankruptcy',
      ['COURTLISTENER_API_TOKEN'],
      'Federal bankruptcy-only docket references filtered to bankruptcy court jurisdictions.',
      'public_record',
    ),
    item(
      'nhtsa_vpic',
      'NHTSA vPIC',
      [],
      'Authoritative VIN decoding; not a vehicle-history report.',
      'public_record',
    ),
    item(
      'vinaudit_vehicle_history',
      'VinAudit vehicle history',
      ['VINAUDIT_API_KEY', 'VINAUDIT_USERNAME', 'VINAUDIT_PASSWORD', 'VINAUDIT_REPORT_ID'],
      'Licensed U.S. vehicle-history records, including NMVTIS-backed title and history data where returned.',
      'licensed_api',
    ),
    item(
      'vinaudit_plate_to_vin',
      'VinAudit Plate to VIN',
      ['VINAUDIT_API_KEY'],
      'Licensed U.S. plate-and-state to VIN resolution; not ownership or registration proof.',
      'licensed_api',
    ),
    item(
      'nppes',
      'NPPES NPI Registry',
      [],
      'Public U.S. healthcare provider and NPI records.',
      'public_record',
    ),
    item(
      'nyc_acris',
      'NYC ACRIS',
      [],
      'Official New York City recorded-property instruments.',
      'public_record',
    ),
    item(
      'ofac',
      'OFAC sanctions data',
      [],
      'Official U.S. sanctions records and screening leads.',
      'public_record',
    ),
    item(
      'rdap',
      'IANA / registry RDAP',
      [],
      'Authoritative domain registration and registry metadata.',
      'public_record',
    ),
  ]

  return NextResponse.json({
    integrations,
    summary: summarizeConfiguration(integrations),
    security: {
      secretValuesReturned: false,
      note: 'Only configuration names and presence are exposed. No network, entitlement, license or accuracy test was performed.',
    },
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
