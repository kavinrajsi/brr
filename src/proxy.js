import { NextResponse } from 'next/server'

// Generate a per-request nonce so the CSP can drop 'unsafe-inline' from
// script-src. Inline scripts in the layout (Google Analytics) reference
// the nonce via headers() in the server component.
//
// Next.js 16 renamed `middleware.js` to `proxy.js` and the export from
// `middleware()` to `proxy()`. Same runtime semantics; same matcher config.

export function proxy(request) {
  const isDev = process.env.NODE_ENV === 'development'

  // 16 random bytes → 24-char base64. Web Crypto is available in the edge runtime.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')

  const csp = [
    "default-src 'self'",

    // Scripts: nonce-allowlisted only. 'strict-dynamic' lets nonce'd scripts
    // load further scripts they depend on without us listing every CDN.
    // 'unsafe-eval' is required by React Server Components in dev for stack
    // reconstruction; production runs without it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ''}`,

    // Styles: 'unsafe-inline' kept because Tailwind utility classes and
    // Next.js font loader emit inline style attributes. Style-src nonces
    // would require touching every component that uses style={{...}}.
    "style-src 'self' 'unsafe-inline'",

    // Images: data: for embedded SVG placeholders, blob: for next/image,
    // self for static assets. No wildcard — drop the previous img-src 'https:'.
    "img-src 'self' data: blob:",

    // Fonts: next/font self-hosts Google fonts so 'self' is enough.
    "font-src 'self' data:",

    // Outbound network: Supabase REST + Realtime WS, Stripe (Checkout iframe
    // calls back to api.stripe.com), Anthropic (no — server side only),
    // Google Analytics (region1 endpoint added — most GA traffic now hits it).
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.stripe.com',
      'https://checkout.stripe.com',
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
    ].join(' '),

    // Frames: Stripe Checkout opens an iframe for card entry.
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",

    // Modern hardening directives — the audit specifically called these out
    "frame-ancestors 'none'",   // app pages cannot be iframed (overrides X-Frame-Options)
    "object-src 'none'",        // no <object>/<embed> — blocks Flash-style payload
    "base-uri 'self'",          // <base href=...> can't redirect resource resolution
    "form-action 'self'",       // forms can only POST to our own origin
  ].join('; ')

  // Stash nonce in request headers so the layout can read it via headers()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-csp', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Skip API routes (they don't render HTML so CSP is moot), static assets,
  // and the embed widget (which has its own header config in next.config.mjs).
  matcher: [
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico|embed/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
