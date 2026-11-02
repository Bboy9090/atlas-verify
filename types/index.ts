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

export interface EnrichmentProvider {
  name: string;
  type: 'phone_lookup' | 'web_search';
  sourcePolicy: ProviderSourcePolicy;
  lookup(input: string): Promise<EnrichmentPayload>;
}

export interface EvidenceFactInput {
  field: string;
  value: unknown;
  sourceName: string;
  sourceUrl?: string;
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
  | 'LOGIN'
  | 'LOGOUT';
