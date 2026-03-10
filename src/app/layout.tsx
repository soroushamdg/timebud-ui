import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { SplashScreen } from "@/components/layout/SplashScreen";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <SplashScreen />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
