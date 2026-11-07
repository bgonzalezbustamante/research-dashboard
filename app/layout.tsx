import type { Metadata } from 'next'
import { Noto_Serif, Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  display: 'swap',
})

const notoSerif = Noto_Serif({
  variable: '--font-noto-serif',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://dashboard.bgonzalezbustamante.com'
  ),
  title: 'Research Dashboard | Dr. Bastián González-Bustamante',
  description: 'Research planning, working hours, and paper tracking.',
  // Search engines may list only the public Academic API docs (/api),
  // which overrides this; every other page stays out of search results.
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${notoSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}