import type { EnrichmentProvider, EnrichmentPayload } from '@/types'

// Provider Registry
const providers = new Map<string, EnrichmentProvider>()

export function registerProvider(provider: EnrichmentProvider) {
  providers.set(provider.name, provider)
}

export function getProvider(name: string): EnrichmentProvider | undefined {
  return providers.get(name)
}

export function getAllProviders(): EnrichmentProvider[] {
  return Array.from(providers.values())
}

export function getProvidersByType(type: 'phone_lookup' | 'web_search'): EnrichmentProvider[] {
  return getAllProviders().filter(p => p.type === type)
}
