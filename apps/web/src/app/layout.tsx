import type { Metadata } from "next";
import { Pixelify_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Floodlit Arcade type system (see /brand.md + docs/design/DESIGN_GUIDE.md)
// Display = Pixelify Sans · Body = Space Grotesk · Data/mono = JetBrains Mono
// (JetBrains Mono is the interim mono; target self-host = Departure Mono.)
const display = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"] });
const sans = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KICK.FUN · watch the World Cup with friends",
  description:
    "Predict live off signed World Cup data. Provably real, on-chain. The terrace, in your pocket.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
