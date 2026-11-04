import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

interface RdapBootstrap {
  services?: Array<[string[], string[]]>
}

interface RdapEvent {
  eventAction?: string
  eventDate?: string
}

interface RdapEntity {
  roles?: string[]
  vcardArray?: [string, Array<[string, Record<string, unknown>, string, unknown]>]
  handle?: string
  publicIds?: Array<{ type?: string; identifier?: string }>
}

interface RdapDomain {
  objectClassName?: string
  handle?: string
  ldhName?: string
  unicodeName?: string
  status?: string[]
  nameservers?: Array<{ ldhName?: string; unicodeName?: string }>
  events?: RdapEvent[]
  entities?: RdapEntity[]
  secureDNS?: { delegationSigned?: boolean }
  links?: Array<{ rel?: string; href?: string; type?: string }>
  remarks?: Array<{ title?: string; description?: string[] }>
}

function normalizedDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '')
}

function eventDate(events: RdapEvent[] | undefined, action: string) {
  return events?.find(event => event.eventAction === action)?.eventDate ?? null
}

function publicEntityName(entity: RdapEntity) {
  const rows = entity.vcardArray?.[1] ?? []
  const fn = rows.find(row => row[0] === 'fn')?.[3]
  return typeof fn === 'string' && fn.trim() ? fn.trim() : null
}

function publicEntity(entity: RdapEntity) {
  const name = publicEntityName(entity)
  const roles = entity.roles ?? []
  const identifiers = (entity.publicIds ?? [])
    .map(item => ({ type: item.type ?? null, identifier: item.identifier ?? null }))
    .filter(item => item.identifier)
  if (!name && !entity.handle && identifiers.length === 0) return null
  return {
    roles,
    name,
    handle: entity.handle ?? null,
    publicIds: identifiers,
  }
}

function fact(field: string, value: unknown, sourceUrl: string, retrievedAt: string, confidence = 0.98): EvidenceFactInput | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value) && value.length === 0) return null
  return {
    field,
    value,
    sourceName: 'Authoritative RDAP service',
    sourceType: 'public_record',
    sourceUrl,
    retrievedAt,
    confidenceScore: confidence,
    corroborationCount: 0,
    conflictCount: 0,
    legalBasis: 'Public domain registration data exposed by the authoritative RDAP service',
    metadata: {
      identityProof: false,
      publicOnly: true,
      redactedDataRecovered: false,
    },
  }
}

async function authoritativeBase(domain: string) {
  const tld = domain.split('.').pop()
  if (!tld) throw new Error('Domain must include a top-level domain')

  const response = await fetch('https://data.iana.org/rdap/dns.json', {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  })
  if (!response.ok) throw new Error(`IANA RDAP bootstrap failed with HTTP ${response.status}`)
  const bootstrap = (await response.json()) as RdapBootstrap

  for (const [tlds, urls] of bootstrap.services ?? []) {
    if (tlds.some(item => item.toLowerCase() === tld.toLowerCase()) && urls[0]) {
      return urls[0]
    }
  }
  throw new Error(`No authoritative RDAP service is published for .${tld}`)
}

const rdapDomainProvider: EnrichmentProvider = {
  name: 'iana_authoritative_rdap',
  type: 'domain_registration',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: true,
    termsUrl: 'https://www.icann.org/resources/pages/domain-name-registration-data-2023-11-02-en',
    licenseName: 'IANA RDAP bootstrap + authoritative registry/registrar RDAP',
    freshnessSeconds: 86400,
    allowedPurposes: [
      'domain_registration_research',
      'business_due_diligence',
      'cybersecurity_research',
      'case_research',
    ],
    mayPersist: true,
    notes:
      'Queries only public RDAP registration data. Redacted or nonpublic registration data is not recovered or inferred.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const domain = normalizedDomain(input)
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain)) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Enter a valid fully-qualified domain name' }
    }

    try {
      const base = await authoritativeBase(domain)
      const endpoint = new URL(`domain/${encodeURIComponent(domain)}`, base.endsWith('/') ? base : `${base}/`)
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/rdap+json, application/json' },
        cache: 'no-store',
        redirect: 'follow',
      })

      if (response.status === 404) {
        return {
          success: true,
          data: { domain, registered: false, authoritativeUrl: endpoint.toString(), publicOnly: true },
          confidenceScore: 0.95,
          evidenceFacts: [],
        }
      }
      if (!response.ok) {
        return { success: false, data: { status: response.status }, confidenceScore: 0, error: `Authoritative RDAP lookup failed with HTTP ${response.status}` }
      }

      const rdap = (await response.json()) as RdapDomain
      const retrievedAt = new Date().toISOString()
      const selfUrl =
        rdap.links?.find(link => link.rel === 'self' && link.href)?.href ??
        endpoint.toString()
      const entities = (rdap.entities ?? []).map(publicEntity).filter((item): item is NonNullable<typeof item> => Boolean(item))
      const registrar = entities.find(entity => entity.roles.includes('registrar')) ?? null
      const registrant = entities.find(entity => entity.roles.includes('registrant')) ?? null
      const nameservers = (rdap.nameservers ?? [])
        .map(item => item.ldhName || item.unicodeName || '')
        .filter(Boolean)

      const result = {
        domain: rdap.ldhName || rdap.unicodeName || domain,
        registered: true,
        registryHandle: rdap.handle ?? null,
        statuses: rdap.status ?? [],
        createdAt: eventDate(rdap.events, 'registration'),
        updatedAt: eventDate(rdap.events, 'last changed'),
        expiresAt: eventDate(rdap.events, 'expiration'),
        nameservers,
        dnssecSigned: rdap.secureDNS?.delegationSigned ?? null,
        registrar,
        registrant,
        publicEntities: entities,
        authoritativeUrl: selfUrl,
        publicOnly: true,
        identityConfirmed: false,
        limitation: 'Only registration data made public by the authoritative RDAP service is returned. Redacted or nonpublic registrant details are not available through this lane.',
      }

      const facts = [
        fact('domain.name', result.domain, selfUrl, retrievedAt),
        fact('domain.registry_handle', result.registryHandle, selfUrl, retrievedAt),
        fact('domain.status', result.statuses, selfUrl, retrievedAt),
        fact('domain.created_at', result.createdAt, selfUrl, retrievedAt),
        fact('domain.updated_at', result.updatedAt, selfUrl, retrievedAt),
        fact('domain.expires_at', result.expiresAt, selfUrl, retrievedAt),
        fact('domain.nameservers', result.nameservers, selfUrl, retrievedAt),
        fact('domain.dnssec_signed', result.dnssecSigned, selfUrl, retrievedAt),
        fact('domain.registrar', result.registrar, selfUrl, retrievedAt, 0.95),
        fact('domain.registrant_public', result.registrant, selfUrl, retrievedAt, 0.8),
      ].filter((item): item is EvidenceFactInput => Boolean(item))

      return { success: true, data: result, confidenceScore: 0.98, evidenceFacts: facts }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'RDAP lookup failed',
      }
    }
  },
}

registerProvider(rdapDomainProvider)

export default rdapDomainProvider
