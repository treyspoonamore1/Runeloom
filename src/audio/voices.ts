/**
 * Voice bookkeeping for the audio system (DESIGN §13): at most `maxVoices` sounds at once and a
 * minimum gap between repeats of the same sound. Pure: time is passed in, so tests need no clock.
 */

export interface VoiceRequest {
  id: string;
  /** Current time, ms. */
  now: number;
  /** How long the sound will play, ms. */
  durationMs: number;
  /** Minimum ms since the last accepted play of this id. */
  minGapMs: number;
  /** A full limiter lets a higher priority replace the oldest lower-priority voice. */
  priority: number;
}

export interface VoiceGrant {
  ok: boolean;
  /** Token for `release()` when the voice ends early. Only when ok. */
  voice?: number;
  /** A voice the caller must stop to make room. Only when ok. */
  evict?: number;
}

interface Voice {
  token: number;
  id: string;
  endsAt: number;
  startedAt: number;
  priority: number;
}

export class VoiceLimiter {
  private voices: Voice[] = [];
  private lastPlay = new Map<string, number>();
  private nextToken = 1;

  constructor(readonly maxVoices: number) {}

  get active(): number {
    return this.voices.length;
  }

  /** Asks to start a sound. Refused when it repeats too soon or the limiter is full of louder voices. */
  request(r: VoiceRequest): VoiceGrant {
    this.voices = this.voices.filter((v) => v.endsAt > r.now);
    const last = this.lastPlay.get(r.id);
    if (last !== undefined && r.now - last < r.minGapMs) return { ok: false };

    let evict: number | undefined;
    if (this.voices.length >= this.maxVoices) {
      // Replace the oldest voice of the lowest priority, if it's below the newcomer's.
      let victim: Voice | undefined;
      for (const v of this.voices)
        if (
          !victim ||
          v.priority < victim.priority ||
          (v.priority === victim.priority && v.startedAt < victim.startedAt)
        )
          victim = v;
      if (!victim || victim.priority >= r.priority) return { ok: false };
      this.voices = this.voices.filter((v) => v !== victim);
      evict = victim.token;
    }
    const token = this.nextToken++;
    this.voices.push({
      token,
      id: r.id,
      endsAt: r.now + r.durationMs,
      startedAt: r.now,
      priority: r.priority,
    });
    this.lastPlay.set(r.id, r.now);
    return { ok: true, voice: token, evict };
  }

  /** The voice ended before its expected time (or its source reported ended). */
  release(token: number): void {
    this.voices = this.voices.filter((v) => v.token !== token);
  }

  clear(): void {
    this.voices = [];
    this.lastPlay.clear();
  }
}
