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
        {/* Brand — clean Lippu logo image + Survivor wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 py-3 px-4 -ml-4 focus-ring rounded-xl"
          aria-label="Lippu Survivor — Inicio"
        >
          <img
            src="/lippu-logo.png"
            alt="Lippu"
            className="h-7 sm:h-8 w-auto object-contain shrink-0"
          />
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-lg tracking-tight text-purple-400">
              Survivor
            </span>
            <span className="hidden sm:inline-block text-xs font-mono tracking-wide rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 ml-2">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-glow cursor-pointer active:scale-[0.98] transition-all duration-200 focus-ring"
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
                className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98] transition-all duration-200 focus-ring"
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
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-surface cursor-pointer active:scale-[0.98] transition-all duration-200"
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
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface cursor-pointer active:scale-[0.95] transition-all duration-200 focus-ring"
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl animate-fade-in-up">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2">
            {/* Profile block (authenticated) */}
            {!loading && !isGuest && profile && (
              <Link
                href="/my-leagues"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3 mb-1 hover:border-purple-500/40 transition-colors focus-ring"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-sm font-bold text-white shrink-0">
                  {avatarInitial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white truncate">
                    {displayName}
                  </span>
                  <span className="block text-xs text-zinc-400 truncate">
                    {profile.email}
                  </span>
                </span>
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-semibold uppercase tracking-wider">
                  Mi Cuenta
                </span>
              </Link>
            )}

            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`min-h-[44px] inline-flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-ring ${
                  isActive(link.href)
                    ? "bg-primary/15 text-accent border border-primary/30"
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
                className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-glow cursor-pointer active:scale-[0.98] transition-all duration-200 focus-ring"
              >
                <UserRound className="w-4 h-4" />
                Iniciar Sesión
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  signOut();
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-medium text-danger border border-danger/30 bg-danger/10 hover:bg-danger/20 cursor-pointer active:scale-[0.98] transition-all duration-200 focus-ring"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
