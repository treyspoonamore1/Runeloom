export interface Summary {
  n: number;
  mean: number;
  p99: number;
  max: number;
}

/** Mean, p99 and max of a sample list (milliseconds). */
export function summarize(samples: ArrayLike<number>): Summary {
  const n = samples.length;
  if (n === 0) return { n: 0, mean: 0, p99: 0, max: 0 };
  const sorted = Float64Array.from(samples as ArrayLike<number>).sort();
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i]!;
  return { n, mean: sum / n, p99: sorted[Math.min(n - 1, Math.ceil(n * 0.99) - 1)]!, max: sorted[n - 1]! };
}
