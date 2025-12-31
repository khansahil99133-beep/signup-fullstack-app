export type AppMode = "all" | "public" | "admin";

export function getAppMode(envValue?: string): AppMode {
  const raw =
    envValue ??
    (typeof import.meta !== "undefined" ? import.meta.env.VITE_APP_MODE : undefined) ??
    "all";
  const normalized = String(raw).toLowerCase();
  if (normalized === "public" || normalized === "admin" || normalized === "all") return normalized;
  return "all";
}
