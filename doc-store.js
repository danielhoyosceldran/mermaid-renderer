// Document storage in localStorage.
//
// Layout — one pair of keys per document, and no shared index:
//   mermaid-renderer:doc:<id>    the text, stored raw
//   mermaid-renderer:meta:<id>   {name, createdAt, updatedAt, rev, size}
//   sessionStorage
//     mermaid-renderer:active    the document THIS tab has open
//
// Why no index. Chromium caches localStorage per renderer process and updates
// a tab's cache from the `storage` event. A tab reacting to another tab's
// write can therefore still read a stale value for a key whose event it has
// not processed yet. With a single index holding every document, a
// read-modify-write from inside an event handler would write that stale
// snapshot back and silently undo the other tab's save. Per-document keys
// remove the shared mutable state, so a write can only ever affect the
// document it belongs to, and `list()` is a cheap scan instead.
//
// Two further rules keep a write safe:
//   * The body is written before its metadata. An interrupted save leaves a
//     body without metadata, which recover() re-registers, so text survives.
//   * Metadata carries a `rev`. A save whose base rev is behind the stored one
//     is reported as a conflict instead of overwriting.

const NS = 'mermaid-renderer:';
const BODY_PREFIX = NS + 'doc:';
const META_PREFIX = NS + 'meta:';
const ACTIVE_KEY = NS + 'active';
const LEGACY_BODY_KEY = NS + 'diagram';
const LEGACY_INDEX_KEY = NS + 'docs';

const MAX_NAME_LENGTH = 80;

export class QuotaError extends Error {
  constructor(cause) {
    super('Browser storage is full or blocked');
    this.name = 'QuotaError';
    this.cause = cause;
  }
}

export class ConflictError extends Error {
  constructor(storedRev, baseRev) {
    super('Document was changed in another tab');
    this.name = 'ConflictError';
    this.storedRev = storedRev;
    this.baseRev = baseRev;
  }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function bodyKey(id) {
  return BODY_PREFIX + id;
}

function metaKey(id) {
  return META_PREFIX + id;
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    throw new QuotaError(err);
  }
}

function drop(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing useful to do; a stray key is harmless.
  }
}

function keysWithPrefix(prefix) {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) found.push(key);
    }
  } catch {
    return [];
  }
  return found;
}

/** Parse stored metadata into a complete meta object, or null if unusable. */
export function parseMeta(id, raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    id,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    createdAt: Number(parsed.createdAt) || 0,
    updatedAt: Number(parsed.updatedAt) || 0,
    rev: Number(parsed.rev) || 0,
    size: Number(parsed.size) || 0,
  };
}

function readMeta(id) {
  return parseMeta(id, read(metaKey(id)));
}

function writeMeta(meta) {
  write(
    metaKey(meta.id),
    JSON.stringify({
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      rev: meta.rev,
      size: meta.size,
    })
  );
  return meta;
}

function normalizeName(name) {
  if (name === null || name === undefined) return null;
  const trimmed = String(name).replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : null;
}

export function displayName(meta) {
  if (!meta) return 'Untitled';
  return meta.name || 'Untitled';
}

/** localStorage bytes used by the documents, for the manager's footer. */
export function usage() {
  let units = 0;
  for (const prefix of [BODY_PREFIX, META_PREFIX]) {
    for (const key of keysWithPrefix(prefix)) {
      units += key.length + (read(key) || '').length;
    }
  }
  // UTF-16 code units, which is what browsers count against the quota.
  return units * 2;
}

export function list() {
  return keysWithPrefix(META_PREFIX)
    .map((key) => readMeta(key.slice(META_PREFIX.length)))
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function get(id) {
  const meta = readMeta(id);
  if (!meta) return null;
  const text = read(bodyKey(id));
  // A registered document whose body vanished reads as empty rather than
  // missing, so callers never have to tell the two apart.
  return { meta, text: text === null ? '' : text };
}

/** The document this tab has open. Per tab, so tabs do not fight over it. */
export function activeId() {
  let id = null;
  try {
    id = sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    id = null;
  }
  if (id && readMeta(id)) return id;
  return null;
}

export function setActive(id) {
  try {
    sessionStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Without sessionStorage the tab simply reopens the most recent document.
  }
}

/** A name not already taken by another document ("plan" -> "plan (2)"). */
export function uniqueName(base, exceptId) {
  const wanted = normalizeName(base) || 'Untitled';
  const taken = new Set(
    list()
      .filter((m) => m.id !== exceptId && m.name)
      .map((m) => m.name.toLowerCase())
  );
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const candidate = `${wanted} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function nameTaken(name, exceptId) {
  const wanted = normalizeName(name);
  if (!wanted) return false;
  return list().some(
    (m) => m.id !== exceptId && m.name && m.name.toLowerCase() === wanted.toLowerCase()
  );
}

export function create({ name = null, text = '', makeActive = true } = {}) {
  const id = newId();
  const now = Date.now();
  write(bodyKey(id), text);
  const meta = writeMeta({
    id,
    name: normalizeName(name),
    createdAt: now,
    updatedAt: now,
    rev: 1,
    size: text.length,
  });
  if (makeActive) setActive(id);
  return meta;
}

/**
 * Write `text` as the document's new body.
 *
 * `baseRev` is the revision the caller last saw; when the stored revision has
 * moved past it another tab has written, and a ConflictError is thrown unless
 * `force` is set.
 */
export function save(id, text, { baseRev = null, force = false } = {}) {
  const stored = readMeta(id);
  if (!stored) throw new Error('No such document: ' + id);
  if (!force && baseRev !== null && stored.rev > baseRev) {
    throw new ConflictError(stored.rev, baseRev);
  }
  write(bodyKey(id), text);
  return writeMeta({
    ...stored,
    updatedAt: Date.now(),
    rev: stored.rev + 1,
    size: text.length,
  });
}

export function rename(id, name) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('A document name cannot be empty');
  const stored = readMeta(id);
  if (!stored) return null;
  return writeMeta({
    ...stored,
    name: normalized,
    updatedAt: Date.now(),
    rev: stored.rev + 1,
  });
}

export function duplicate(id) {
  const doc = get(id);
  if (!doc) return null;
  return create({
    name: uniqueName(displayName(doc.meta)),
    text: doc.text,
    makeActive: false,
  });
}

export function remove(id) {
  // Metadata first: without it the document is gone from every listing, and a
  // leftover body would only be picked up by recover() as rescued text.
  drop(metaKey(id));
  drop(bodyKey(id));
}

/**
 * Re-register bodies that have no metadata (an interrupted save, or metadata
 * lost some other way) and drop metadata whose body is gone.
 */
export function recover() {
  const bodies = new Set(keysWithPrefix(BODY_PREFIX).map((k) => k.slice(BODY_PREFIX.length)));
  const metas = new Set(keysWithPrefix(META_PREFIX).map((k) => k.slice(META_PREFIX.length)));
  const recovered = [];

  for (const id of bodies) {
    if (metas.has(id) && readMeta(id)) continue;
    const text = read(bodyKey(id)) || '';
    const now = Date.now();
    try {
      writeMeta({
        id,
        name: uniqueName('Recovered'),
        createdAt: now,
        updatedAt: now,
        rev: 1,
        size: text.length,
      });
      recovered.push(id);
    } catch {
      // Out of space: leave the body alone so it can be recovered later.
    }
  }

  for (const id of metas) {
    if (!bodies.has(id)) drop(metaKey(id));
  }

  return recovered;
}

/**
 * Import documents written by earlier versions: the single-diagram key, and
 * the shared index that replaced it.
 */
export function migrateLegacy() {
  const migrated = [];

  const indexRaw = read(LEGACY_INDEX_KEY);
  if (indexRaw) {
    try {
      const index = JSON.parse(indexRaw);
      for (const [id, raw] of Object.entries((index && index.docs) || {})) {
        if (readMeta(id) || read(bodyKey(id)) === null) continue;
        const text = read(bodyKey(id)) || '';
        migrated.push(
          writeMeta({
            id,
            name: normalizeName(raw && raw.name),
            createdAt: Number(raw && raw.createdAt) || Date.now(),
            updatedAt: Number(raw && raw.updatedAt) || Date.now(),
            rev: Number(raw && raw.rev) || 1,
            size: text.length,
          })
        );
      }
    } catch {
      // A corrupt index is nothing to salvage; recover() picks up the bodies.
    }
    drop(LEGACY_INDEX_KEY);
  }

  const legacyBody = read(LEGACY_BODY_KEY);
  if (legacyBody !== null) {
    migrated.push(create({ name: null, text: legacyBody }));
    drop(LEGACY_BODY_KEY);
  }

  return migrated;
}

/**
 * Fires when another tab writes a document.
 *
 * `kind` is 'body', 'meta' or 'other'; for a 'meta' change the parsed value is
 * passed along, because the event carries it and this tab's own read of that
 * key may still be stale.
 */
export function onExternalChange(callback) {
  const handler = (e) => {
    if (e.storageArea !== localStorage) return;
    if (e.key === null) {
      callback({ id: null, kind: 'cleared', meta: null });
      return;
    }
    if (e.key.startsWith(BODY_PREFIX)) {
      callback({ id: e.key.slice(BODY_PREFIX.length), kind: 'body', meta: null });
      return;
    }
    if (e.key.startsWith(META_PREFIX)) {
      const id = e.key.slice(META_PREFIX.length);
      callback({ id, kind: 'meta', meta: parseMeta(id, e.newValue) });
      return;
    }
    callback({ id: null, kind: 'other', meta: null });
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export const KEYS = { BODY_PREFIX, META_PREFIX, ACTIVE_KEY, LEGACY_BODY_KEY, LEGACY_INDEX_KEY };
