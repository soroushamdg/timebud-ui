import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'TimeBud',
  description: 'Your focus companion',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <Providers initialSession={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
