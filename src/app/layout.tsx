import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/context/AuthContext";
import { APP_BASE_URL } from "@/lib/survivor-utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_BASE_URL),
  title: {
    default: "Lippu Survivor 2026 — NFL Survivor Pool",
    template: "%s | Lippu Survivor",
  },
  description:
    "Crea tu liga privada o únete a ligas públicas de la NFL. Haz tu pick semanal, evita la eliminación y gana la bolsa acumulada.",
  keywords: [
    "NFL",
    "Survivor Pool",
    "Lippu",
    "Ligas NFL",
    "Picks NFL",
    "Super Bowl 2026",
  ],
  authors: [{ name: "Lippu" }],
  creator: "Lippu",
  publisher: "Lippu",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Lippu Survivor 2026 — NFL Survivor Pool",
    description:
      "Crea tu liga privada o únete a ligas públicas. Haz tu pick semanal, evita la eliminación y llévate la bolsa acumulada.",
    url: APP_BASE_URL,
    siteName: "Lippu Survivor",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "/lippu-survivor-og-graph-image.png",
        width: 1200,
        height: 630,
        alt: "Lippu Survivor 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lippu Survivor 2026",
    description: "NFL Survivor Pool — Crea tu liga o únete a ligas públicas.",
    images: ["/lippu-survivor-og-graph-image.png"],
  },
  /* icons auto-detected from src/app/icon.png + apple-icon.png */
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#100719",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background text-text-primary font-sans">
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
