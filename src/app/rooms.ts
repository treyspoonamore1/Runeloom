/** Room files bundled by Vite (CLAUDE.md rule 6). Keyed by room id, e.g. "test/m0_room". */
const files = import.meta.glob('../../data/rooms/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const roomTexts: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*data\/rooms\//, '').replace(/\.txt$/, ''),
    text,
  ]),
);

export function roomText(id: string): string {
  const text = roomTexts[id];
  if (text === undefined)
    throw new Error(`Unknown room "${id}". Known: ${Object.keys(roomTexts).join(', ')}`);
  return text;
}
