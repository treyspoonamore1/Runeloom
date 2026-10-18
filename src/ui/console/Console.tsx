import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { CommandRegistry } from './commands';
import type { ConsoleEnv } from './builtins';

export interface OutLine {
  text: string;
  kind: 'in' | 'out' | 'err' | 'hint';
}

export const consoleOpen = signal(false);
export const consoleLines = signal<OutLine[]>([
  { text: 'Runeloom dev console. Type "help". Tab completes, Up/Down is history, Esc closes.', kind: 'hint' },
]);
const MAX_LINES = 400;

export function printLines(lines: OutLine[]): void {
  consoleLines.value = [...consoleLines.value, ...lines].slice(-MAX_LINES);
}

const history: string[] = [];

export function Console(p: {
  reg: CommandRegistry<ConsoleEnv>;
  env: ConsoleEnv;
  onFocus(on: boolean): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const hist = useRef({ idx: 0, draft: '' });

  useEffect(() => {
    if (consoleOpen.value) inputRef.current?.focus();
  }, [consoleOpen.value]);
  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consoleLines.value]);

  if (!consoleOpen.value) return null;

  const run = (line: string) => {
    printLines([{ text: `> ${line}`, kind: 'in' }]);
    if (line.trim() && history[history.length - 1] !== line) history.push(line);
    hist.current.idx = history.length;
    const res = p.reg.execute(line, p.env);
    printLines(res.lines.map((text) => ({ text, kind: res.ok ? 'out' : 'err' })));
  };

  const onKey = (e: KeyboardEvent) => {
    const input = e.currentTarget as HTMLInputElement;
    e.stopPropagation();
    if (e.key === 'Escape' || e.code === 'Backquote') {
      e.preventDefault();
      consoleOpen.value = false;
    } else if (e.key === 'Enter') {
      run(input.value);
      input.value = '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const c = p.reg.complete(input.value);
      input.value = c.text;
      if (c.candidates.length > 1) printLines([{ text: c.candidates.join('  '), kind: 'hint' }]);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = hist.current;
      if (h.idx === history.length) h.draft = input.value;
      h.idx = Math.max(0, Math.min(history.length, h.idx + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = h.idx === history.length ? h.draft : (history[h.idx] ?? '');
    }
  };

  return (
    <div class="dbg-console">
      <div class="dbg-console-out" ref={outRef}>
        {consoleLines.value.map((l, i) => (
          <div key={i} class={`dbg-line-${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
      <div class="dbg-console-in">
        <span>&gt;</span>
        <input
          ref={inputRef}
          type="text"
          spellcheck={false}
          autocomplete="off"
          onKeyDown={onKey}
          onFocus={() => p.onFocus(true)}
          onBlur={() => p.onFocus(false)}
        />
      </div>
    </div>
  );
}
