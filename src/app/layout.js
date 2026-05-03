import { headers } from 'next/headers'
import { IBM_Plex_Sans } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata = {
  title: 'BRR AI Training',
  description: 'Train AI agents on brand BRR',
}

export default async function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  // Nonce comes from src/proxy.js — applied to inline scripts so we can
  // drop 'unsafe-inline' from the CSP script-src.
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="en" className={ibmPlexSans.variable}>
      <head>
        {gaId && (
          <>
            <script
              async
              nonce={nonce}
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              nonce={nonce}
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{page_path:window.location.pathname});`,
              }}
            />
          </>
        )}
      </head>
      <body>
        <AuthProvider>
          <OrganizationProvider>{children}</OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
