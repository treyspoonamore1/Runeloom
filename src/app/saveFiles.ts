/** Save files (browser only): the export file name and reading a picked file. Exports go through app/handoff.ts. */

/** "runeloom-lv6-2026-10-19-1730.json" (local time). */
export function saveFileName(level: number, ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `runeloom-lv${level}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
