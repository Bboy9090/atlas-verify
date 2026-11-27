/** In-memory request lifetime only. Cancelled or superseded responses cannot be displayed. */
export function createSearchSession() {
  let active: AbortController | null = null
  return {
    begin() {
      active?.abort()
      const controller = new AbortController()
      active = controller
      return controller
    },
    cancel() {
      active?.abort()
      active = null
    },
    isCurrent(controller: AbortController) {
      return active === controller && !controller.signal.aborted
    },
  }
}
