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
  title: "Slashly - AI Voice Assistant for Business",
  description: "Talk to Slashly, the AI assistant that helps automate slide creation, outreach, sales, and team productivity.",
  openGraph: {
    title: "SSlashly - AI Voice Assistant for Business",
    description: "Talk to Slashly, the AI assistant that helps automate slide creation, outreach, sales, and team productivity.",
    images: [
      {
        url: "/saascraft-meta.png",
        width: 1200,
        height: 720,
        alt: "Slashly - AI Voice Assistant for Business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sprrrint SaasCraft Landing Page in React",
    description: "By @jonpadven, support me on X",
    images: ["/saascraft-meta.png"],
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
