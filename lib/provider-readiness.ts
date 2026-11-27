/** Configuration is not a health check, license review, or accuracy measurement. */
export type ConfigurationState = 'configured' | 'missing_configuration' | 'public_no_key'

export function configurationState(required: readonly string[], env: Readonly<Record<string, string | undefined>>) {
  const missingVariables = required.filter(name => !env[name]?.trim())
  const status: ConfigurationState = required.length === 0
    ? 'public_no_key'
    : missingVariables.length > 0 ? 'missing_configuration' : 'configured'
  return { status, missingVariables, verification: 'not_tested' as const }
}

export function summarizeConfiguration(items: readonly { status: ConfigurationState }[]) {
  return {
    operational: null,
    configured: items.filter(item => item.status === 'configured').length,
    publicNoKey: items.filter(item => item.status === 'public_no_key').length,
    missingConfiguration: items.filter(item => item.status === 'missing_configuration').length,
    total: items.length,
    liveVerifiedCount: 0,
    liveVerificationPerformed: false,
  }
}

/** Synthetic adapters never enter production, even with inconsistent policy flags. */
export function providerAllowed(
  policy: { sourceKind: string; production: boolean },
  env: Readonly<Record<string, string | undefined>>,
) {
  if (policy.sourceKind === 'synthetic') {
    return env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? env.ALLOW_SYNTHETIC_PROVIDERS === 'true'
      : false
  }
  return policy.production === true
}
