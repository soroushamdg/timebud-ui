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

  // Rendering the right data-theme attribute server-side (rather than a client-only
  // localStorage read) means the very first byte of HTML is already correctly
  // themed — no flash-of-wrong-theme, no inline bootstrap script needed. 'dark' (the
  // default) and logged-out visitors render no attribute at all, matching how
  // applyThemeAttribute treats 'dark' as the implicit case everywhere else.
  let themeAttribute: string | undefined;
  if (session?.user) {
    const { data: aiSettings } = await supabase
      .from("user_ai_settings")
      .select("theme_preference")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (aiSettings?.theme_preference && aiSettings.theme_preference !== "dark") {
      themeAttribute = aiSettings.theme_preference;
    }
  }

  return (
    <html lang="en" className={`dark ${inter.variable}`} data-theme={themeAttribute}>
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
