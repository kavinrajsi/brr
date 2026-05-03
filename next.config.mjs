/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Empty allowlist — the next/image optimiser will only fetch from the
    // app's own origin. Previously remotePatterns: [{ hostname: '**' }]
    // turned the optimiser into an open SSRF / bandwidth proxy.
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP for app pages is set per-request in src/proxy.js so we can
          // include a fresh nonce. These static headers cover everything
          // that doesn't pass through the proxy (API routes, static assets)
          // — they're cheap and additive.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      // Embed widget — must be iframable from arbitrary origins, but the
      // chat endpoint enforces per-token allowed_origin so a bad iframe
      // host cannot make it talk. Skipped by the middleware matcher.
      {
        source: '/embed/:path*',
        headers: [
          // Allow only HTTPS embedders. http: parents and javascript:/data:
          // contexts are blocked. Per-agent origin restriction happens at
          // the chat API layer via the token's allowed_origin column.
          { key: 'Content-Security-Policy', value: "frame-ancestors https:" },
          // Strict same-origin referrer policy so the parent's URL is sent
          // for embed-origin verification but not propagated further.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
