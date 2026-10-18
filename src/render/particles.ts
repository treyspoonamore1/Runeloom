import { Particle, ParticleContainer, type Texture } from 'pixi.js';

/** A pooled particle; the motion fields are used only by free-flying effects (FxLayer). */
export class FxParticle extends Particle {
  /** Index in the container's particleChildren, -1 when free. */
  idx = -1;
  vx = 0;
  vy = 0;
  /** Seconds left and total. */
  life = 0;
  maxLife = 1;
  /** Velocity damping per second (v *= 1 / (1 + drag·dt)). */
  drag = 0;
  /** Acceleration along +y, cells/s² (negative rises). */
  grav = 0;
  spin = 0;
  /** Scale at birth and death; stretch adds length along the velocity (cells per cell/s). */
  s0 = 1;
  s1 = 1;
  /** Height relative to width. */
  aspect = 1;
  stretch = 0;
  /** Peak alpha, and the fraction of life before fading starts. */
  a0 = 1;
  hold = 0;
  /** Rotate to face the velocity. */
  align = false;
  /** Tint as BGR, for writing `color` directly (the tint setter parses colors, slowly). */
  bgr = 0xffffff;

  /** Sets tint (0xRRGGBB) and alpha without going through Pixi's color parsing. */
  paint(rgb: number, alpha: number): void {
    this.bgr = ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 0xff);
    this.fade(alpha);
  }

  /** Sets alpha, keeping the painted tint. */
  fade(alpha: number): void {
    const a = alpha <= 0 ? 0 : alpha >= 1 ? 255 : (alpha * 255) | 0;
    this.color = (this.bgr + (a << 24)) >>> 0;
  }
}

const ALL_DYNAMIC = { position: true, rotation: true, vertex: true, color: true, uvs: true };

/**
 * A ParticleContainer with a free list. Released particles are swap-removed, so order inside a
 * layer is arbitrary. All textures must come from the shared atlas.
 */
export class ParticlePool {
  readonly container: ParticleContainer<FxParticle>;
  private readonly free: FxParticle[] = [];
  private readonly live: FxParticle[];

  constructor(
    texture: Texture,
    readonly capacity: number,
    blend: 'normal' | 'add' = 'normal',
  ) {
    this.container = new ParticleContainer<FxParticle>({ dynamicProperties: ALL_DYNAMIC, texture });
    this.container.blendMode = blend;
    this.live = this.container.particleChildren;
  }

  get count(): number {
    return this.live.length;
  }

  /** Creates particles up to capacity into the free list. */
  protected prewarm(texture: Texture): void {
    while (this.free.length < this.capacity) this.free.push(new FxParticle(texture));
  }

  /** A particle showing `texture` with its default anchor, or null when the pool is full. */
  alloc(texture: Texture): FxParticle | null {
    if (this.live.length >= this.capacity) return null;
    let p = this.free.pop();
    if (!p) p = new FxParticle(texture);
    else p.texture = texture;
    p.anchorX = texture.defaultAnchor?.x ?? 0.5;
    p.anchorY = texture.defaultAnchor?.y ?? 0.5;
    p.rotation = 0;
    p.scaleX = p.scaleY = 1;
    p.paint(0xffffff, 1);
    p.idx = this.live.length;
    this.live.push(p);
    return p;
  }

  release(p: FxParticle): void {
    if (p.idx < 0) return;
    const last = this.live.pop()!;
    if (last !== p) {
      this.live[p.idx] = last;
      last.idx = p.idx;
    }
    p.idx = -1;
    this.free.push(p);
  }

  clear(): void {
    for (const p of this.live) {
      p.idx = -1;
      this.free.push(p);
    }
    this.live.length = 0;
  }

  /** Live particles (do not add or remove through this). */
  get items(): readonly FxParticle[] {
    return this.live;
  }
}

/** Free-flying particles that move, scale and fade on their own, then free themselves. */
export class FxLayer extends ParticlePool {
  constructor(texture: Texture, capacity: number, blend: 'normal' | 'add' = 'normal') {
    super(texture, capacity, blend);
    // Build every particle up front so a burst of deaths never constructs objects mid-fight.
    this.prewarm(texture);
  }

  spawn(
    tex: Texture,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    tint: number,
    s0: number,
    s1: number,
  ): FxParticle | null {
    const p = this.alloc(tex);
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.maxLife = life;
    p.paint(tint, 1);
    p.s0 = s0;
    p.s1 = s1;
    p.drag = 0;
    p.grav = 0;
    p.spin = 0;
    p.aspect = 1;
    p.stretch = 0;
    p.a0 = 1;
    p.hold = 0;
    p.align = false;
    p.scaleX = p.scaleY = s0;
    return p;
  }

  update(dt: number): void {
    const list = this.items;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      if (p.drag > 0) {
        const k = 1 / (1 + p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.life / p.maxLife;
      const s = p.s0 + (p.s1 - p.s0) * t;
      let sx = s;
      if (p.align) {
        p.rotation = Math.atan2(p.vy, p.vx);
        if (p.stretch > 0) sx = s * (1 + Math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.stretch);
      } else if (p.spin !== 0) {
        p.rotation += p.spin * dt;
      }
      p.scaleX = sx;
      p.scaleY = s * p.aspect;
      const fade = t <= p.hold ? 1 : (1 - t) / (1 - p.hold);
      p.fade(p.a0 * fade);
    }
  }
}

/**
 * A pool redrawn from scratch every frame: begin(), next() per item in draw order, end().
 * Particles are reused in place and the unused tail is released, so steady frames allocate
 * nothing and keep their order. For per-frame overlays (status icons, ailment glows).
 */
export class ImmediatePool extends ParticlePool {
  private n = 0;

  begin(): void {
    this.n = 0;
  }

  /** The next particle showing `texture` (anchor from the texture), or null when full. */
  next(texture: Texture): FxParticle | null {
    const list = this.items;
    let p: FxParticle | null;
    if (this.n < list.length) {
      p = list[this.n]!;
      if (p.texture !== texture) {
        p.texture = texture;
        p.anchorX = texture.defaultAnchor?.x ?? 0.5;
        p.anchorY = texture.defaultAnchor?.y ?? 0.5;
      }
      p.rotation = 0;
    } else {
      p = this.alloc(texture);
      if (!p) return null;
    }
    this.n++;
    return p;
  }

  end(): void {
    const list = this.items;
    while (list.length > this.n) this.release(list[list.length - 1]!);
  }
}
