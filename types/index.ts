export type ProviderSourceKind =
  | 'synthetic'
  | 'licensed_api'
  | 'public_web'
  | 'public_record'
  | 'user_supplied';

export interface ProviderSourcePolicy {
  sourceKind: ProviderSourceKind;
  production: boolean;
  termsUrl?: string;
  licenseName?: string;
  freshnessSeconds?: number;
  allowedPurposes: string[];
  mayPersist: boolean;
  notes?: string;
}

export interface ProviderSubjectInput {
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  username?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface EnrichmentProvider {
  name: string;
  type: 'phone_lookup' | 'web_search' | 'person_search' | 'vehicle_vin' | 'professional_license' | 'business_entity' | 'property_record' | 'sanctions_watchlist';
  sourcePolicy: ProviderSourcePolicy;
  lookup?: (input: string) => Promise<EnrichmentPayload>;
  lookupSubject?: (subject: ProviderSubjectInput) => Promise<EnrichmentPayload>;
}

export interface EvidenceFactInput {
  field: string;
  value: unknown;
  sourceName: string;
  sourceType?: ProviderSourceKind;
  sourceUrl?: string;
  sourceLocator?: string;
  normalizedValue?: string;
  rawRecordHash?: string;
  legalBasis?: string;
  retrievedAt: string;
  observedAt?: string;
  confidenceScore: number;
  corroborationCount?: number;
  conflictCount?: number;
  metadata?: Record<string, unknown>;
}

export interface EnrichmentPayload {
  success: boolean;
  data: Record<string, unknown>;
  confidenceScore: number;
  evidenceFacts?: EvidenceFactInput[];
  error?: string;
}

export interface PhoneLookupResult {
  carrier?: string;
  lineType?: string;
  countryCode?: string;
  nationalFormat?: string;
  callerName?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface WebSearchResult {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
  }>;
  totalResults: number;
}

export type AuditAction = 
  | 'CREATE_CASE'
  | 'UPDATE_CASE'
  | 'DELETE_CASE'
  | 'CREATE_SUBJECT'
  | 'UPDATE_SUBJECT'
  | 'DELETE_SUBJECT'
  | 'RUN_ENRICHMENT'
  | 'RUN_SEARCH'
  | 'EXPORT_CASE_REPORT'
  | 'SUBMIT_EVIDENCE_DISPUTE'
  | 'RESOLVE_EVIDENCE_DISPUTE'
  | 'REVIEW_SUPPRESSION_REQUEST'
  | 'CREATE_MONITOR'
  | 'CHECK_MONITOR'
  | 'DELETE_MONITOR'
  | 'LOGIN'
  | 'LOGOUT';
