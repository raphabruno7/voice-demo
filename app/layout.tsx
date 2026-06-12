import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import AgentNav from "@/components/AgentNav";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ana — Voice AI Demo · Raphael Bruno",
  description: "Talk to a live AI agent. Voice agent demo by Raphael Bruno, AI automation specialist.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const dict = dictionaries[lang];

  return (
    <html
      lang={lang}
      className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AgentNav lang={lang} dict={dict.nav} />
        {children}
      </body>
    </html>
  );
}
