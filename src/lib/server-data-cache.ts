export function shouldUseServerDataCache() {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  // Authenticated server data on Vercel was hitting long-lived background
  // revalidations after mutations, which kept functions alive and amplified
  // cross-region database latency. Prefer direct reads there for stability.
  return process.env.VERCEL !== "1";
}
