export function isPrivacyReviewer(email: string | null | undefined): boolean {
  if (!email) return false

  const configured = (process.env.PRIVACY_REVIEWER_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  return configured.includes(email.trim().toLowerCase())
}
