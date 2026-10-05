import { fetchJson } from "./_kv.js";
export const REPO = "https://api.github.com/repos/asdfjkl231580/quota-radar";
export const SITE_ORIGIN = "https://airesetclock.com";
// Daily collection plus two hours of scheduling/recovery grace.
export const COLLECTION_MAX_AGE_MINUTES = 26 * 60;

export function githubHeaders() {
  return {
    ...(process.env.GH_DISPATCH_TOKEN ? { Authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}` } : {}),
    Accept: "application/vnd.github+json", "User-Agent": "airesetclock-health", "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function repositoryJson(path) {
  // Public repository: no token scope expansion and no Contents API anonymous quota.
  const minute = Math.floor(Date.now() / 60000);
  return fetchJson(`https://raw.githubusercontent.com/asdfjkl231580/quota-radar/main/${path}?check=${minute}`, {
    cache: "no-store", headers: { "Cache-Control": "no-cache", "User-Agent": "airesetclock-health" }
  }, "github");
}

const validTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validVersion = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);

// A quiet event feed is healthy when collection is current and the target snapshot is deployed.
export function assessHealth(health, release, live, now = Date.now()) {
  const reasons = [];
  const lastSuccessAt = validTime(health?.lastSuccessAt) ? health.lastSuccessAt : null;
  const lastAttemptAt = validTime(health?.lastAttemptAt) ? health.lastAttemptAt : null;
  const ageMinutes = lastSuccessAt ? Math.floor((now - Date.parse(lastSuccessAt)) / 60000) : null;
  if (!health || health.schemaVersion !== 1 || !["ok", "degraded", "error"].includes(health.status) || !lastAttemptAt) reasons.push("collection_unknown");
  else if (health.status === "error") reasons.push("collection_failed");
  else if (health.status === "degraded") reasons.push("sources_degraded");
  if (ageMinutes === null || ageMinutes > COLLECTION_MAX_AGE_MINUTES || ageMinutes < -1) reasons.push("collection_stale");
  const targetVersion = validVersion(release?.targetVersion) ? release.targetVersion : null;
  const deployedVersion = validVersion(release?.deployedVersion) ? release.deployedVersion : null;
  const liveVersion = validVersion(live?.version) ? live.version : null;
  if (!targetVersion || !deployedVersion || !liveVersion || !Array.isArray(live?.events)) reasons.push("release_unknown");
  else if (targetVersion !== deployedVersion || deployedVersion !== liveVersion) reasons.push("release_mismatch");
  if (release?.lastError) reasons.push("release_failed");
  const severe = reasons.some((reason) => reason !== "sources_degraded");
  return {
    status: severe ? "error" : reasons.length ? "degraded" : "ok", checkedAt: new Date(now).toISOString(), reasons,
    schedule: { frequency: "daily", time: "09:30", timeZone: "Asia/Shanghai", maxAgeMinutes: COLLECTION_MAX_AGE_MINUTES },
    collector: { status: reasons.some((reason) => reason.startsWith("collection_")) ? "error" : health?.status === "degraded" ? "degraded" : "ok", lastAttemptAt, lastSuccessAt, ageMinutes },
    release: { status: reasons.some((reason) => reason.startsWith("release_")) ? "error" : "ok", targetVersion, deployedVersion, productionVersion: liveVersion, deployedAt: validTime(release?.deployedAt) ? release.deployedAt : null },
    // Deliberately omit upstream errors, account identifiers, tokens and notification receipts.
    eventsUpdatedAt: validTime(live?.updatedAt) ? live.updatedAt : null
  };
}

export async function readHealth() {
  const result = await Promise.allSettled([
    repositoryJson("data/health.json"), repositoryJson("data/release.json"),
    fetchJson(`${SITE_ORIGIN}/api/events.json?health=${Math.floor(Date.now() / 60000)}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }, "production")
  ]);
  const values = result.map((item) => item.status === "fulfilled" ? item.value : null);
  return assessHealth(...values);
}
