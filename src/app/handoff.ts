/**
 * Getting saves and F9 replays out of the browser. A claude.ai Artifact blocks plain downloads,
 * so files go through the page's runtime capabilities when they exist (window.claude.use):
 *
 * - `downloads`: the viewer confirms and saves the file. Elsewhere (dev server, a static
 *   build) an <a download> link does it.
 * - `db`: a copy goes into the Artifact's database under `reports/<id>` (a header doc, the text
 *   in `reports/<id>/parts/<k>` chunks under the 256 KiB document cap), where Claude can read it
 *   when the designer reports a bug. Absent outside an Artifact: then nothing is sent.
 */

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

interface DownloadsNs {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}

interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
}
interface DbNs {
  doc(path: string): DocRef;
}

/** Text per database part: well under the 256 KiB document cap even if every char is 3 UTF-8 bytes. */
const PART_CHARS = 60_000;

function use<T>(name: string): Promise<T | null> {
  const c = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!c || typeof c.use !== 'function') return Promise.resolve(null);
  return c.use(name).then(
    (ns) => (ns ?? null) as T | null,
    () => null,
  );
}

function anchorDownload(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Offers `text` as a file. Resolves what happened, for a toast or note. */
export async function saveFile(name: string, text: string): Promise<string> {
  const downloads = await use<DownloadsNs>('downloads');
  if (!downloads) {
    anchorDownload(name, text);
    return `Saved ${name}`;
  }
  try {
    await downloads.save({ filename: name, data: new Blob([text]) });
    return `Saved ${name}`;
  } catch (e) {
    const code = (e as { code?: string }).code;
    return code === 'declined' ? 'Download cancelled' : `Download unavailable here (${code ?? 'error'})`;
  }
}

/**
 * Stores `text` in the Artifact's database for Claude (see the file comment). Resolves the
 * report id, or null when there is no database here or a write failed.
 */
export async function sendToClaude(
  kind: 'save' | 'replay' | 'crash',
  name: string,
  text: string,
  meta: Record<string, string | number | boolean> = {},
): Promise<string | null> {
  const db = await use<DbNs>('db');
  if (!db) return null;
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}`;
  const parts = Math.max(1, Math.ceil(text.length / PART_CHARS));
  try {
    for (let k = 0; k < parts; k++)
      await db
        .doc(`reports/${id}/parts/${String(k).padStart(4, '0')}`)
        .set({ k, text: text.slice(k * PART_CHARS, (k + 1) * PART_CHARS) });
    await db.doc(`reports/${id}`).set({ kind, name, parts, chars: text.length, sentAt: Date.now(), ...meta });
    return id;
  } catch {
    return null;
  }
}
