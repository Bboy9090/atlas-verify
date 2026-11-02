import type { EnrichmentProvider, EnrichmentPayload } from '@/types'
import { registerProvider } from './enrichment-provider'

interface TwilioLookupResponse {
  calling_country_code?: string | null
  country_code?: string | null
  phone_number?: string | null
  national_format?: string | null
  valid?: boolean
  validation_errors?: string[] | null
  line_type_intelligence?: {
    error_code?: number | null
    mobile_country_code?: string | null
    mobile_network_code?: string | null
    carrier_name?: string | null
    type?: string | null
  } | null
}

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

const twilioPhoneProvider: EnrichmentProvider = {
  name: 'twilio_lookup_v2',
  type: 'phone_lookup',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: true,
    termsUrl: 'https://www.twilio.com/legal/tos',
    licenseName: 'Twilio Lookup',
    freshnessSeconds: 0,
    allowedPurposes: [
      'phone_validation',
      'identity_verification',
      'case_research',
      'fraud_prevention',
    ],
    mayPersist: true,
    notes:
      'Twilio Lookup v2. Basic validation/formatting plus line type intelligence when the account is entitled to that package.',
  },

  async lookup(phoneNumber: string): Promise<EnrichmentPayload> {
    if (!accountSid || !authToken) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Twilio Lookup credentials are not configured',
      }
    }

    const trimmed = phoneNumber.trim()
    if (!trimmed) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Phone number is required',
      }
    }

    const endpoint = new URL(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(trimmed)}`
    )
    endpoint.searchParams.set('Fields', 'line_type_intelligence')

    const authorization = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const body = (await response.json()) as TwilioLookupResponse & {
      code?: number
      message?: string
      more_info?: string
    }

    if (!response.ok) {
      return {
        success: false,
        data: {
          status: response.status,
          code: body.code,
        },
        confidenceScore: 0,
        error: body.message || `Twilio Lookup failed with HTTP ${response.status}`,
      }
    }

    const retrievedAt = new Date().toISOString()
    const valid = body.valid === true
    const lineType = body.line_type_intelligence?.type ?? undefined
    const carrier = body.line_type_intelligence?.carrier_name ?? undefined

    const data = {
      valid,
      phoneNumber: body.phone_number ?? trimmed,
      nationalFormat: body.national_format ?? undefined,
      countryCode: body.country_code ?? undefined,
      callingCountryCode: body.calling_country_code ?? undefined,
      validationErrors: body.validation_errors ?? [],
      carrier,
      lineType,
      mobileCountryCode: body.line_type_intelligence?.mobile_country_code ?? undefined,
      mobileNetworkCode: body.line_type_intelligence?.mobile_network_code ?? undefined,
    }

    const evidenceFacts = [
      {
        field: 'phone.valid',
        value: valid,
        sourceName: 'Twilio Lookup v2',
        sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api',
        retrievedAt,
        confidenceScore: 0.99,
      },
      ...(body.phone_number
        ? [{
            field: 'phone.e164',
            value: body.phone_number,
            sourceName: 'Twilio Lookup v2',
            sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api',
            retrievedAt,
            confidenceScore: 0.99,
          }]
        : []),
      ...(body.national_format
        ? [{
            field: 'phone.nationalFormat',
            value: body.national_format,
            sourceName: 'Twilio Lookup v2',
            sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api',
            retrievedAt,
            confidenceScore: 0.99,
          }]
        : []),
      ...(body.country_code
        ? [{
            field: 'phone.countryCode',
            value: body.country_code,
            sourceName: 'Twilio Lookup v2',
            sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api',
            retrievedAt,
            confidenceScore: 0.99,
          }]
        : []),
      ...(carrier
        ? [{
            field: 'phone.carrier',
            value: carrier,
            sourceName: 'Twilio Lookup v2',
            sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api/line-type-intelligence',
            retrievedAt,
            confidenceScore: 0.95,
          }]
        : []),
      ...(lineType
        ? [{
            field: 'phone.lineType',
            value: lineType,
            sourceName: 'Twilio Lookup v2',
            sourceUrl: 'https://www.twilio.com/docs/lookup/v2-api/line-type-intelligence',
            retrievedAt,
            confidenceScore: 0.95,
          }]
        : []),
    ]

    return {
      success: true,
      data,
      confidenceScore: valid ? 0.98 : 0.99,
      evidenceFacts,
    }
  },
}

if (accountSid && authToken) {
  registerProvider(twilioPhoneProvider)
}

export default twilioPhoneProvider
