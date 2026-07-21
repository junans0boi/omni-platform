import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const saved=localStorage.getItem("omni-theme");const dark=saved?saved==="dark":!matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.classList.toggle("dark",dark)}catch{}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
