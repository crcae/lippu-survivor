import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lippu Survivor 2026 — NFL Survivor Pool",
  description:
    "The ultimate NFL Survivor pool experience. Pick one team each week, survive the season, and claim the prize. Powered by Lippu.",
  keywords: ["NFL", "Survivor", "Pool", "Football", "Lippu", "2026"],
  openGraph: {
    title: "Lippu Survivor 2026",
    description: "The ultimate NFL Survivor pool experience.",
    siteName: "Lippu Survivor",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
