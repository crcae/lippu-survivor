"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FootballIcon } from "@/components/ui";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import { getCurrentUser, type CurrentUser } from "@/lib/services/survivor-db";

const NAV_LINKS = [
  { href: "/league/demo", label: "Dashboard Demo" },
  { href: "/league/create", label: "Crear Liga" },
  { href: "/league/join", label: "Unirse con Código" },
];

const linkClass =
  "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring";

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((curr) => {
        if (!cancelled) setUser(curr);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Jugador";
  const avatarInitial = (displayName[0] || "J").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-md bg-background/80">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 focus-ring rounded-xl">
          <span className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-glow shrink-0">
            <FootballIcon className="w-5 h-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-text-primary whitespace-nowrap">
            Lippu <span className="text-primary">Survivor</span>{" "}
            <span className="hidden sm:inline text-sm font-medium text-text-secondary">
              {SEASON_YEAR}
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${linkClass} ${
                isActive(link.href)
                  ? "bg-primary/15 text-accent border border-primary/30"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User pill */}
        <div className="hidden md:flex items-center gap-3">
          <div
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/40 transition-all duration-200 focus-ring"
            title={user?.email ? `Conectado como ${user.email}` : "Perfil de usuario"}
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-xs font-bold text-accent">
              {avatarInitial}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface-elevated" />
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {displayName}
            </span>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface transition-colors focus-ring"
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-surface/95 backdrop-blur-md animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`${linkClass} ${
                  isActive(link.href)
                    ? "bg-primary/15 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border/50 my-2" />
            <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-text-primary">
              <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-xs font-bold text-accent">
                {avatarInitial}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
              </span>
              {displayName}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
