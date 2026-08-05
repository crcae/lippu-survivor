import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { LeagueDashboard } from "./LeagueDashboardClient";

const DEFAULT_APP_URL = "https://survivor.lippu.app";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? DEFAULT_APP_URL
  );
}

type LeaguePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Loads the league name for metadata. Public (active/completed) leagues are
 * readable without a session; anything else (draft leagues, missing league,
 * unreachable DB) falls back to a generic league title.
 */
async function getLeagueName(id: string): Promise<string | null> {
  if (id === "demo") return null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("leagues")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Dynamic metadata for a league page. `/league/demo` always shows the demo
 * fallback so it never depends on Supabase.
 */
export async function generateMetadata({
  params,
}: LeaguePageProps): Promise<Metadata> {
  const { id } = await params;
  const base = appUrl();

  if (id === "demo") {
    const demoTitle = "Liga de Demostración | Lippu Survivor 2026";
    const demoDescription =
      "Explora la liga de demostración de Lippu Survivor 2026: haz tus picks semanales y sobrevive la temporada.";

    return {
      title: demoTitle,
      description: demoDescription,
      openGraph: {
        title: demoTitle,
        description: demoDescription,
        url: `${base}/league/demo`,
        siteName: "Lippu Survivor",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: demoTitle,
        description: demoDescription,
      },
    };
  }

  const leagueName = await getLeagueName(id);

  const title = leagueName
    ? `${leagueName} | Lippu Survivor 2026`
    : "Liga | Lippu Survivor 2026";
  const description = leagueName
    ? `¡Únete a la liga ${leagueName} en Lippu Survivor 2026! Haz tus picks, sigue la tabla y sobrevive la temporada.`
    : "Únete a una liga de Lippu Survivor 2026: haz tus picks semanales y sobrevive la temporada.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/league/${id}`,
      siteName: "Lippu Survivor",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { id } = await params;
  return <LeagueDashboard leagueId={id} />;
}
