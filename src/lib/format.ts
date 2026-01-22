import type { Team } from "@/lib/firestore";

export function formatAmount(value: number) {
  const numericValue = Number(value) || 0;
  return new Intl.NumberFormat("en-IN").format(numericValue);
}

export function formatTeamLabel(team?: Team | null) {
  if (!team?.name) {
    return "-";
  }
  const captainName = team.captainName?.trim();
  return captainName ? `${team.name} (${captainName})` : team.name;
}
