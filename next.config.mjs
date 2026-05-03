const isDev = process.env.NODE_ENV === 'development'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval is required by React in dev mode for call stack reconstruction
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://www.google-analytics.com",
            ].join('; '),
          },
        ],
      },
      // Embed widget — must be iframable from arbitrary origins, but the
      // chat endpoint enforces per-token allowed_origin so a bad iframe
      // host cannot make it talk. X-Frame-Options omitted intentionally
      // (no value works for "any HTTPS origin"); browsers honour CSP.
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
