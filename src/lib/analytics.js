'use client'

export function trackPagePerformance() {
  if (typeof window === 'undefined') return

  window.addEventListener('load', () => {
    // Use Navigation Timing Level 2 (Level 1 `performance.timing` is deprecated)
    const [nav] = performance.getEntriesByType('navigation')
    const pageLoadMs = nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0
    if (window.gtag) {
      window.gtag('event', 'page_load_time', { value: pageLoadMs, event_category: 'performance' })
    }
  })
}

export function trackEvent(name, data = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, data)
  }
}
