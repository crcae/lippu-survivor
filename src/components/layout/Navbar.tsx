"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import { MyLeaguesDropdown } from "@/components/navigation/MyLeaguesDropdown";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "Explorar Ligas" },
  { href: "/my-leagues", label: "Mis Ligas" },
  { href: "/create-league", label: "Crear Liga" },
  { href: "/league/join", label: "Unirse con Código" },
];

const linkClass =
  "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring";

export function Navbar() {
  const pathname = usePathname();
  const { profile, isGuest, loading, openAuth, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    const close = setTimeout(() => setAccountOpen(false), 0);
    return () => clearTimeout(close);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href);

  const displayName = profile?.displayName || "Mi Cuenta";
  const avatarInitial = (profile?.displayName?.[0] || "L").toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand — typography-only wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-ring rounded-xl"
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              LIPPU SURVIVOR
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              2026
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            link.href === "/my-leagues" ? (
              <MyLeaguesDropdown key={link.href} />
            ) : (
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
            ),
          )}
        </div>

        {/* Right side: sign-in state */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? null : isGuest ? (
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-glow transition-all duration-200 focus-ring"
            >
              <UserRound className="w-4 h-4" />
              Iniciar Sesión
            </button>
          ) : (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/40 transition-all duration-200 focus-ring"
                title={profile?.email ? `Conectado como ${profile.email}` : "Mi cuenta"}
              >
                <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-xs font-bold text-accent">
                  {avatarInitial}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface-elevated" />
                </span>
                <span className="text-sm font-semibold text-text-primary max-w-[140px] truncate">
                  {displayName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 ${
                    accountOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-surface-elevated shadow-elevated z-50 overflow-hidden animate-fade-in"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-text-secondary truncate mt-0.5">
                      {profile?.email ?? ""}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/my-leagues"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-text-primary hover:bg-surface transition-colors"
                    >
                      <UserRound className="w-4 h-4 text-info" />
                      Mi Cuenta
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-surface transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
        <div className="md:hidden border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md animate-fade-in">
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
            <div className="border-t border-zinc-800/80 my-2" />
            {loading ? null : isGuest ? (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  openAuth();
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                <UserRound className="w-4 h-4" />
                Iniciar Sesión
              </button>
            ) : (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-text-primary">
                  <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-xs font-bold text-accent">
                    {avatarInitial}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
                  </span>
                  {displayName}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    signOut();
                  }}
                  className="inline-flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-danger"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
