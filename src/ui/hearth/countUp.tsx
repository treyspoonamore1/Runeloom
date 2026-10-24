/** Numbers that roll to their new value (Embers, Ash, building levels) and pulse when they rise. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { countUp, countUpMs, fmtCompact, fmtNum } from './hearthModel';

const reduced = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The value shown while rolling from its last value to `target`. */
export function useRolling(target: number): number {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    if (reduced() || typeof requestAnimationFrame !== 'function') {
      cur.current = target;
      setShown(target);
      return;
    }
    const ms = countUpMs(from, target);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const v = countUp(from, target, (now - t0) / ms);
      cur.current = v;
      setShown(v);
      if (v !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

/** A number that rolls and pulses on change. `compact`: 12.5k style for tight HUD spots. */
export function CountUp(p: { value: number; compact?: boolean; class?: string }) {
  const shown = useRolling(p.value);
  // The pulse class stays for as long as this target value does, so re-renders while rolling keep it.
  const info = useRef({ value: p.value, dir: '' });
  if (info.current.value !== p.value)
    info.current = { value: p.value, dir: p.value > info.current.value ? 'up' : 'down' };
  return (
    <b key={p.value} class={`hx-num ${info.current.dir} ${p.class ?? ''}`}>
      {p.compact ? fmtCompact(shown) : fmtNum(shown)}
    </b>
  );
}
