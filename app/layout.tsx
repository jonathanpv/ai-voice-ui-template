import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import localFont from 'next/font/local';

import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  variable: "--font-instrument-serif",
  subsets: ["latin"],
});

const sfRounded = localFont({
  src: './sfrounded.otf',
  variable: '--sf-rounded'
})

export const metadata: Metadata = {
  title: "AI Voice UI template by @jonpadven",
  description: "Voice UI components / demos, by @jonpadven, support me on X",
  openGraph: {
    title: "AI Voice UI template by @jonpadven",
    description: "Talk to Slashly, the AI assistant that helps automate slide creation, outreach, sales, and team productivity.",
    images: [
      {
        url: "/voiceui-og.png",
        width: 1200,
        height: 720,
        alt: "Voice UI components / demos, by @jonpadven, support me on X",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Voice UI template by @jonpadven",
    description: "Voice UI components / demos, by @jonpadven, support me on X",
    images: ["/voiceui-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${sfRounded.variable} font-[family-name:var(--font-geist-sans)] w-screen flex flex-col items-center justify-center`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
