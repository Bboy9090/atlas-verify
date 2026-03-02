// Import all providers to register them
import './mock-phone-provider'
import './mock-search-provider'

// Re-export provider utilities
export { getProvider, getAllProviders, getProvidersByType, registerProvider } from './enrichment-provider'
