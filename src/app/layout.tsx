import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "श्री गणेश भोजनालय - AI Restaurant Management",
  description: "Voice-first restaurant management system for Indian restaurants",
  keywords: ["restaurant", "voice", "AI", "management", "India", "food", "orders"],
  authors: [{ name: "Restaurant AI Team" }],
  robots: "index, follow",
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#ff9500",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
