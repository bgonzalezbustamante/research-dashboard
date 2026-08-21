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
  title: 'Research Dashboard | Dr. Bastián González-Bustamante',
  description: 'Research planning, working hours, and paper tracking.',
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