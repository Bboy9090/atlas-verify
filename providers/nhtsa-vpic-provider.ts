import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended'
const TERMS_URL = 'https://vpic.nhtsa.dot.gov/api/'

interface VpicResponse {
  Count?: number
  Message?: string
  Results?: Array<Record<string, unknown>>
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function fact(
  field: string,
  value: unknown,
  vin: string,
  retrievedAt: string,
  sourceUrl: string
): EvidenceFactInput | null {
  const normalized = stringValue(value)
  if (!normalized) return null

  return {
    field,
    value: normalized,
    normalizedValue: normalized.toLowerCase(),
    sourceName: 'NHTSA vPIC',
    sourceType: 'public_record',
    sourceUrl,
    sourceLocator: `VIN:${vin}`,
    legalBasis: 'Official U.S. DOT/NHTSA manufacturer-reported VIN decoding data',
    retrievedAt,
    confidenceScore: 0.99,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      dataset: 'Vehicle Product Information Catalog (vPIC)',
      manufacturerReported: true,
      historyReport: false,
    },
  }
}

const nhtsaVpicProvider: EnrichmentProvider = {
  name: 'nhtsa_vpic',
  type: 'vehicle_vin',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: true,
    termsUrl: TERMS_URL,
    licenseName: 'U.S. DOT / NHTSA public vehicle data',
    freshnessSeconds: 2_592_000,
    allowedPurposes: [
      'Vehicle identification and specification research',
      'VIN decoding',
      'Lawful consumer and investigator research',
    ],
    mayPersist: true,
    notes:
      'Official manufacturer-reported VIN decoding data. This does not provide title, ownership, lien, accident, registration, or vehicle-history records.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const vin = input.trim().toUpperCase()

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'VIN must be 17 characters and cannot contain I, O, or Q.',
      }
    }

    const sourceUrl = `${API_BASE}/${encodeURIComponent(vin)}?format=json`
    const retrievedAt = new Date().toISOString()

    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AtlasVerify/1.0 (+vehicle-vin-research)',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        return {
          success: false,
          data: {},
          confidenceScore: 0,
          error: `NHTSA vPIC returned HTTP ${response.status}.`,
        }
      }

      const payload = await response.json() as VpicResponse
      const row = payload.Results?.[0]

      if (!row) {
        return {
          success: false,
          data: {},
          confidenceScore: 0,
          error: 'NHTSA vPIC returned no decode result.',
        }
      }

      const errorCode = stringValue(row.ErrorCode)
      const errorText = stringValue(row.ErrorText)

      if (errorCode && errorCode !== '0') {
        return {
          success: false,
          data: { errorCode, errorText },
          confidenceScore: 0,
          error: errorText || `NHTSA vPIC decode error ${errorCode}.`,
        }
      }

      const vehicle = {
        vin,
        make: stringValue(row.Make),
        model: stringValue(row.Model),
        modelYear: stringValue(row.ModelYear),
        trim: stringValue(row.Trim),
        series: stringValue(row.Series),
        vehicleType: stringValue(row.VehicleType),
        bodyClass: stringValue(row.BodyClass),
        manufacturer: stringValue(row.Manufacturer),
        plantCity: stringValue(row.PlantCity),
        plantState: stringValue(row.PlantState),
        plantCountry: stringValue(row.PlantCountry),
        fuelTypePrimary: stringValue(row.FuelTypePrimary),
        driveType: stringValue(row.DriveType),
        engineCylinders: stringValue(row.EngineCylinders),
        displacementL: stringValue(row.DisplacementL),
      }

      const evidenceFacts = [
        fact('vehicle.vin', vin, vin, retrievedAt, sourceUrl),
        fact('vehicle.make', vehicle.make, vin, retrievedAt, sourceUrl),
        fact('vehicle.model', vehicle.model, vin, retrievedAt, sourceUrl),
        fact('vehicle.model_year', vehicle.modelYear, vin, retrievedAt, sourceUrl),
        fact('vehicle.trim', vehicle.trim, vin, retrievedAt, sourceUrl),
        fact('vehicle.series', vehicle.series, vin, retrievedAt, sourceUrl),
        fact('vehicle.type', vehicle.vehicleType, vin, retrievedAt, sourceUrl),
        fact('vehicle.body_class', vehicle.bodyClass, vin, retrievedAt, sourceUrl),
        fact('vehicle.manufacturer', vehicle.manufacturer, vin, retrievedAt, sourceUrl),
        fact('vehicle.plant_city', vehicle.plantCity, vin, retrievedAt, sourceUrl),
        fact('vehicle.plant_state', vehicle.plantState, vin, retrievedAt, sourceUrl),
        fact('vehicle.plant_country', vehicle.plantCountry, vin, retrievedAt, sourceUrl),
        fact('vehicle.fuel_type_primary', vehicle.fuelTypePrimary, vin, retrievedAt, sourceUrl),
        fact('vehicle.drive_type', vehicle.driveType, vin, retrievedAt, sourceUrl),
        fact('vehicle.engine_cylinders', vehicle.engineCylinders, vin, retrievedAt, sourceUrl),
        fact('vehicle.displacement_l', vehicle.displacementL, vin, retrievedAt, sourceUrl),
      ].filter((item): item is EvidenceFactInput => Boolean(item))

      return {
        success: true,
        data: {
          vehicle,
          providerMessage: payload.Message ?? null,
          limitation:
            'VIN decode only. No ownership, title, lien, accident, registration, or vehicle-history data is returned by this source.',
        },
        confidenceScore: vehicle.make && vehicle.model && vehicle.modelYear ? 0.99 : 0.9,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'NHTSA vPIC lookup failed.',
      }
    }
  },
}

registerProvider(nhtsaVpicProvider)
