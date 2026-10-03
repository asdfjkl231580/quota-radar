import { createHash } from 'node:crypto';

export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

// Heartbeats and JSON key order must not create another data release.
export function eventVersion(events) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  const sorted = [...events].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return 'sha256:' + createHash('sha256').update(stableJson(sorted)).digest('hex');
}

export function comparePublicSnapshot(expected, actual) {
  if (!expected?.version || actual?.version !== expected.version) return { ok: false, reason: 'event version differs' };
  if (!Array.isArray(actual.events) || stableJson(actual.events) !== stableJson(expected.events)) return { ok: false, reason: 'event content differs' };
  if (actual.updatedAt !== expected.updatedAt) return { ok: false, reason: 'data update time differs' };
  return { ok: true };
}

export function normalizeSource(text) {
  return String(text || '').normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
