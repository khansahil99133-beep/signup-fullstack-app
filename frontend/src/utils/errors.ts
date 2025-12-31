export function resolveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err.length > 0) {
    return err;
  }
  if (err && typeof err === "object" && "message" in err) {
    const candidate = (err as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return fallback;
}
