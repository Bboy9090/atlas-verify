import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth-provider'
import { PwaRegister } from '@/components/pwa-register'

export const metadata = {
  title: "Bobby's Case File — People Search & Evidence Intelligence",
  description: 'People search, public records, evidence intelligence, and case workspace',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Bobby's Case File",
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
        {/* PWA / iOS home-screen meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bobby&#39;s Case File" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <PwaRegister />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
