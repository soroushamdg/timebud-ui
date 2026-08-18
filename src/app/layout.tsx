import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { createClient } from "@/lib/supabase/server";
import { Analytics } from "@vercel/analytics/react";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TimeBud",
  description: "Your focus companion",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"}>
          <Providers initialSession={session}>
            {children}
          </Providers>
        </SerwistProvider>
        <Analytics />
      </body>
    </html>
  );
}
