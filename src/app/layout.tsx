import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omni-Platform",
  description: "A comprehensive communication platform by SteadyToVivid",
  authors: [{ name: "Lee Junhwan", url: "https://steadytovivid.com" }],
  creator: "SteadyToVivid",
  publisher: "SteadyToVivid",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    requestHeaders.get("accept-language")
  );

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const saved=localStorage.getItem("omni-theme");const dark=saved?saved==="dark":!matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.classList.toggle("dark",dark)}catch{}`,
          }}
        />
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
