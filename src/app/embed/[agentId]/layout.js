import '../../globals.css'

export const metadata = { title: 'BRR AI Chat' }

export default function EmbedLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
