import type { Metadata } from "next";
import { Spectral, Karla } from "next/font/google";
import "./globals.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-sans",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-body-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crossroads Wedding Co. | Wedding DJ, Live Music & Bar Service",
  description:
    "Backyard-to-ballroom wedding DJ services starting at $1,000, plus live acoustic sets and licensed bartenders. We run your day so you don't have to.",
  keywords: [
    "wedding DJ",
    "backyard wedding DJ",
    "indie folk wedding music",
    "wedding bartending service",
    "wedding day-of coordinator",
    "affordable wedding DJ",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spectral.variable} ${karla.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
