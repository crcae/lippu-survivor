"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Info,
  Landmark,
  Save,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { Badge, Button, Card, useToast } from "@/components/ui";
import {
  getCommissionerPayoutDetails,
  getLeagueFinancialsInDb,
  saveCommissionerPayoutDetails,
  type FinancialEntryRecord,
  type LeagueFinancials,
} from "@/lib/services/survivor-db";
import { formatMxn } from "@/lib/survivor-utils";
import type { LeagueStatus } from "@/types";

interface CommissionerFinancePanelProps {
  leagueId: string;
  leagueName: string;
  leagueStatus: LeagueStatus;
  leagueType?: "paid" | "free";
  /** The current user's id (must be the league owner — the panel is only
   *  rendered for the commissioner). */
  currentUserId: string;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatClabeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 18);
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

const kpiCardClass =
  "rounded-xl bg-surface border border-border p-4 space-y-2 min-w-0";

function PaymentStatusBadge({ status }: { status: FinancialEntryRecord["paymentStatus"] }) {
  if (status === "approved") {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
        Completado
      </span>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning" className="whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        Pendiente
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/50" />
      Gratis
    </Badge>
  );
}

/**
 * Exclusive "Finanzas de la Liga" panel shown only to the league commissioner.
 * Renders the KPI metric cards (prize pool, platform fee, gross, paid
 * participants), the transaction audit table with text filtering, and the
 * payout card with the commissioner's bank details form.
 */
export function CommissionerFinancePanel({
  leagueId,
  leagueName,
  leagueStatus,
  leagueType,
  currentUserId,
}: CommissionerFinancePanelProps) {
  const { success, error: toastError } = useToast();

  const [financials, setFinancials] = useState<LeagueFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [bankName, setBankName] = useState("");
  const [clabe, setClabe] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reset = setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    getLeagueFinancialsInDb(leagueId)
      .then((data) => {
        if (cancelled) return;
        setFinancials(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las finanzas de la liga.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(reset);
    };
  }, [leagueId]);

  // Pre-fill the payout form with any saved bank details.
  useEffect(() => {
    let cancelled = false;
    getCommissionerPayoutDetails(leagueId, currentUserId)
      .then((details) => {
        if (cancelled) return;
        setBankName(details.bankName);
        setClabe(details.clabe);
        setAccountHolder(details.accountHolder);
        setPayoutLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPayoutLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, currentUserId]);

  const isFree = leagueType === "free" || financials?.leagueType === "free";
  const payoutReady = leagueStatus === "completed";

  const prizePool = financials?.prizePool ?? 0;
  const paidParticipants = financials?.paidParticipants ?? 0;
  const totalEntries = financials?.totalEntries ?? 0;

  const filteredEntries = useMemo(() => {
    const rows = financials?.entries ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((entry) =>
      [
        entry.entryName,
        entry.playerName,
        entry.playerEmail ?? "",
        entry.kushkiTicketNumber ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [financials, filter]);

  const handleSavePayout = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const digits = clabe.replace(/\D/g, "");
    if (digits.length !== 18) {
      toastError("La CLABE interbancaria debe tener exactamente 18 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveCommissionerPayoutDetails(
        leagueId,
        currentUserId,
        {
          bankName: bankName.trim(),
          clabe: digits,
          accountHolder: accountHolder.trim(),
        },
      );
      setBankName(saved.bankName);
      setClabe(saved.clabe);
      setAccountHolder(saved.accountHolder);
      success("Datos de retiro guardados.");
    } catch (err) {
      toastError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar los datos de retiro.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Section header (acts as the finance tab) */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-primary" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Finanzas de la Liga
          </h2>
          <p className="text-xs text-text-secondary">
            Recaudación, auditoría y liquidación de la bolsa.
          </p>
        </div>
      </div>

      {loading && (
        <Card className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-border bg-surface/60 animate-pulse"
            />
          ))}
        </Card>
      )}

      {!loading && loadError && (
        <Card className="border-danger/40 bg-danger/10">
          <p className="text-sm text-danger">{loadError}</p>
        </Card>
      )}

      {!loading && !loadError && (
        <>
          {/* KPI metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card variant="elevated" className={kpiCardClass}>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Bolsa del Premio
                </p>
              </div>
              <p className="text-2xl font-bold text-text-primary tabular-nums">
                {formatMxn(prizePool)}
              </p>
              <p className="text-xs text-text-secondary">
                100% destinado al ganador de la liga
              </p>
            </Card>

            <Card variant="elevated" className={kpiCardClass}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-success" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Participantes Pagados
                </p>
              </div>
              <p className="text-2xl font-bold text-text-primary tabular-nums">
                {paidParticipants}
                <span className="text-base text-text-secondary"> / {totalEntries}</span>
              </p>
              <p className="text-xs text-text-secondary">
                Entradas con pago aprobado
              </p>
            </Card>
          </div>

          {isFree && (
            <div className="rounded-xl border border-info/40 bg-info/10 p-4 flex items-center gap-3">
              <Info className="w-5 h-5 text-info shrink-0" />
              <p className="text-sm text-text-secondary">
                Esta es una liga gratuita: no se cobran entradas, así que los
                montos son $0 MXN y cada jugador aparece como{" "}
                <span className="font-semibold">&quot;Gratis&quot;</span>.
              </p>
            </div>
          )}

          {/* Transaction audit table */}
          <Card variant="elevated" className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-4">
              <div>
                <h3 className="font-bold text-text-primary">
                  Auditoría de Pagos
                </h3>
                <p className="text-xs text-text-secondary">
                  {financials?.entries.length ?? 0} entradas · {paidParticipants}{" "}
                  pagadas
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar por jugador o ticket…"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <p className="text-sm text-text-secondary py-6 text-center">
                {filter.trim()
                  ? "No hay resultados para tu búsqueda."
                  : "Aún no hay jugadores en esta liga."}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                        Jugador
                      </th>
                      <th className="py-2.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                        Estado de Pago
                      </th>
                      <th className="py-2.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap text-right">
                        Monto Entrada
                      </th>
                      <th className="py-2.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                        Ticket
                      </th>
                      <th className="py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.entryId} className="hover:bg-surface/60">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary truncate max-w-[160px]">
                            {entry.entryName}
                          </p>
                          <p className="text-xs text-text-secondary truncate max-w-[160px]">
                            {entry.playerName}
                            {entry.playerEmail
                              ? ` · ${entry.playerEmail}`
                              : ""}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          <PaymentStatusBadge status={entry.paymentStatus} />
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-text-primary whitespace-nowrap">
                          {formatMxn(entry.ticketAmount)}
                        </td>
                        <td className="py-3 pr-4">
                          {entry.kushkiTicketNumber ? (
                            <span
                              className="font-mono text-xs text-text-primary"
                              title={entry.kushkiTicketNumber}
                            >
                              {entry.kushkiTicketNumber.length > 14
                                ? `${entry.kushkiTicketNumber.slice(0, 14)}…`
                                : entry.kushkiTicketNumber}
                            </span>
                          ) : (
                            <span className="text-text-secondary/50">—</span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-text-secondary whitespace-nowrap">
                          {formatDate(entry.paidAt ?? entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Payout section — bank details only apply to paid leagues */}
          {!isFree && (
            <Card variant="elevated" className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center shrink-0">
                  <Landmark className="w-5 h-5 text-success" />
                </span>
                <div>
                  <h3 className="font-bold text-text-primary">
                    Retiro de la Bolsa
                  </h3>
                  <p className="text-xs text-text-secondary">
                    La bolsa de {leagueName} se liquida al ganador.
                  </p>
                </div>
              </div>
              {payoutReady ? (
                <Badge variant="success" className="whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Listo para Liquidación
                </Badge>
              ) : (
                <Badge variant="warning" className="whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  En Recaudación
                </Badge>
              )}
            </div>

            <div className="rounded-xl bg-surface border border-border p-4 text-sm text-text-secondary">
              {payoutReady ? (
                <>
                  La temporada terminó. La bolsa de{" "}
                  <span className="font-bold text-success tabular-nums">
                    {formatMxn(prizePool)}
                  </span>{" "}
                  está lista para liquidarse al ganador.
                </>
              ) : (
                <>
                  La liga está en curso. La bolsa actual es de{" "}
                  <span className="font-bold text-warning tabular-nums">
                    {formatMxn(prizePool)}
                  </span>{" "}
                  y se liquidará al ganador al completar la temporada.
                </>
              )}
            </div>

            <form onSubmit={handleSavePayout} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="payout-bank"
                    className="text-sm font-semibold text-text-primary"
                  >
                    Banco
                  </label>
                  <input
                    id="payout-bank"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ej. BBVA"
                    maxLength={60}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="payout-clabe"
                    className="text-sm font-semibold text-text-primary"
                  >
                    CLABE Interbancaria
                  </label>
                  <input
                    id="payout-clabe"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatClabeInput(clabe)}
                    onChange={(e) => setClabe(formatClabeInput(e.target.value))}
                    placeholder="123 456 789 012 345 678"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="text-[11px] text-text-secondary">
                    18 dígitos · se guarda cifrada del lado del servidor
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="payout-holder"
                    className="text-sm font-semibold text-text-primary"
                  >
                    Titular de la cuenta
                  </label>
                  <input
                    id="payout-holder"
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Nombre del titular"
                    maxLength={80}
                    className={inputClass}
                  />
                </div>
              </div>

              {payoutLoaded && (
                <Button
                  type="submit"
                  variant="secondary"
                  isLoading={saving}
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Guardando…" : "Guardar Datos de Retiro"}
                </Button>
              )}
            </form>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

export type { CommissionerFinancePanelProps };
