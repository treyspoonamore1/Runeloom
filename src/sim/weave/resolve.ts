/**
 * Builds SpellSpec nodes from a validated tree: folds every modifier's effect into resolved
 * numbers (program.ts documents each field). Assumes all compiler checks passed.
 */
import { damageTypes, type DamageAmounts } from '../../../data/combatTypes';
import {
  elements,
  type ElementDef,
  weaveLimits,
  type BranchDef,
  type FormDef,
  type ModifierDef,
  type ProcDef,
  type TriggerDef,
} from '../../../data/runes';
import { scaleByLevel } from '../combat/damage';
import { SIM_HZ } from '../core/constants';
import { fanRotations, rotationDeg } from './angles';
import { defOf, formOf } from './checks';
import { levelAt, qualityAt, type ResolvedContext } from './context';
import { branchComplexity, ownComplexity, ownMana } from './costs';
import type { EffectiveElement } from './elements';
import type {
  BranchSpec,
  ElementShare,
  FormParams,
  MoreMult,
  ProcRule,
  ResolvedFootprint,
  SpellSpec,
  TriggerSpec,
} from './program';
import { childPath, type SpellNode, type WeavePath } from './tree';

type Els = ReadonlyMap<SpellNode, readonly EffectiveElement[]>;

export function resolveTrigger(def: TriggerDef, ctx: ResolvedContext): TriggerSpec {
  let period: number | null = null;
  if (def.period)
    period = Math.max(
      def.period.min,
      def.period.base - def.period.perLevel * (levelAt(ctx, ['trigger']) - 1),
    );
  return {
    id: def.id,
    event: def.event,
    automatic: def.automatic,
    usesCastTime: def.usesCastTime,
    manaMult: def.manaMult,
    icd: def.icd,
    period,
    origin: def.origin,
    aim: def.aim,
    aimRange: def.aimRange ?? null,
    hurtThreshold: def.hurtThreshold ?? null,
    moveSlow: def.moveSlow ?? 0,
  };
}

/**
 * `penalties`: branch damage multipliers from the root down to this spell (empty at the root).
 */
export function resolveSpell(
  spell: SpellNode,
  path: WeavePath,
  depth: number,
  penalties: readonly MoreMult[],
  els: Els,
  ctx: ResolvedContext,
): SpellSpec {
  const form = formOf(spell);
  const mods = spell.items.map(defOf).filter((d): d is ModifierDef => d.kind === 'modifier');
  const fx = foldEffects(mods);
  const eff = els.get(spell) ?? [];
  const elementShares = shareElements(eff);

  const more: MoreMult[] = [];
  for (const m of mods)
    if (m.effect.more !== undefined) more.push({ source: m.id, label: m.name, mult: m.effect.more });
  more.push(...penalties);
  let moreProduct = 1;
  for (const m of more) moreProduct *= m.mult;

  let critChance = form.crit + fx.critChanceAdd;
  let knockback = form.knockback;
  for (const e of eff) {
    critChance += elements[e.id].critAdd;
    knockback *= elements[e.id].knockbackMult;
  }

  const baseDamage = form.damaging
    ? scaleByLevel(form.baseDamage, weaveLimits.runeLevelGrowth, levelAt(ctx, [...path, 'form'])) +
      (form.id === 'strike' ? ctx.strikeFlat : 0)
    : 0;

  const lin = Math.sqrt(fx.areaMult);
  const count = 1 + fx.extraInstances;
  const chain = mods.find((m) => m.effect.chain)?.effect.chain ?? null;
  const fork = mods.find((m) => m.effect.fork)?.effect.fork ?? null;
  const seeker = mods.find((m) => m.effect.seeker)?.effect.seeker ?? null;
  const echo = mods.find((m) => m.effect.echo)?.effect.echo ?? null;

  const children: BranchSpec[] = [];
  let childMana = 0;
  spell.branches.forEach((b, n) => {
    const def = defOf(b.branch) as BranchDef;
    const childPenalties =
      def.damageMult === 1
        ? penalties
        : [
            ...penalties,
            { source: def.id, label: `${def.name} branch (depth ${depth + 1})`, mult: def.damageMult },
          ];
    const spec = resolveSpell(b.spell, childPath(path, n), depth + 1, childPenalties, els, ctx);
    childMana += spec.manaCost;
    children.push({
      branch: def.id,
      proc: resolveProc(def.proc, form, fx.pierce > 0 || chain !== null),
      origin: def.origin,
      aim: def.aim,
      damageMult: def.damageMult,
      complexity: branchComplexity(def, depth + 1),
      spec,
    });
  });

  return {
    path,
    depth,
    form: form.id,
    params: resolveParams(form, fx, lin, depth),
    elements: elementShares,
    shares: sharesByType(elementShares),
    baseDamage,
    increased: qualityAt(ctx, [...path, 'form']) * weaveLimits.qualityDamagePerPoint,
    more,
    moreProduct,
    critChance,
    critMultiplier: ctx.critMultiplier + fx.critMultiAdd,
    knockback,
    instances: { count, fanDeg: count > 1 ? fx.fanDeg : 0, rotations: fanRotations(count, fx.fanDeg) },
    pierce: fx.pierce,
    chain: chain ? { ...chain } : null,
    fork: fork
      ? { count: fork.count, rotations: fanRotations(fork.count, 2 * fork.angleDeg), life: fork.life }
      : null,
    returns: fx.returns,
    seeker: seeker
      ? { turnRateDeg: seeker.turnRateDeg, tickRotation: rotationDeg(seeker.turnRateDeg / SIM_HZ) }
      : null,
    echo: echo ? { ...echo } : null,
    ailmentDurationMult: fx.ailmentDurationMult,
    areaMult: fx.areaMult,
    terrain: {
      footprint: resolveFootprint(form, lin, fx.terrainAreaMult),
      areaMult: fx.terrainAreaMult,
      durationMult: fx.terrainDurationMult,
    },
    canHitSource: form.canHitSource,
    manaCost: ownMana(spell) * ctx.manaCostMult + weaveLimits.branchManaWeight * childMana,
    complexity: ownComplexity(spell),
    children,
  };
}

interface Folded {
  extraInstances: number;
  fanDeg: number;
  pierce: number;
  areaMult: number;
  critChanceAdd: number;
  critMultiAdd: number;
  terrainDurationMult: number;
  terrainAreaMult: number;
  ailmentDurationMult: number;
  durationMult: number;
  speedMult: number;
  lobFlightTimeMult: number;
  returns: boolean;
}

function foldEffects(mods: readonly ModifierDef[]): Folded {
  const f: Folded = {
    extraInstances: 0,
    fanDeg: 0,
    pierce: 0,
    areaMult: 1,
    critChanceAdd: 0,
    critMultiAdd: 0,
    terrainDurationMult: 1,
    terrainAreaMult: 1,
    ailmentDurationMult: 1,
    durationMult: 1,
    speedMult: 1,
    lobFlightTimeMult: 1,
    returns: false,
  };
  for (const { effect: e } of mods) {
    f.extraInstances += e.extraInstances ?? 0;
    f.fanDeg += e.fanDeg ?? 0;
    f.pierce += e.pierce ?? 0;
    f.areaMult *= e.areaMult ?? 1;
    f.critChanceAdd += e.critChanceAdd ?? 0;
    f.critMultiAdd += e.critMultiAdd ?? 0;
    f.terrainDurationMult *= e.terrainDurationMult ?? 1;
    f.terrainAreaMult *= e.terrainAreaMult ?? 1;
    f.ailmentDurationMult *= e.ailmentDurationMult ?? 1;
    f.durationMult *= e.durationMult ?? 1;
    f.speedMult *= e.speedMult ?? 1;
    f.lobFlightTimeMult *= e.lobFlightTimeMult ?? 1;
    f.returns ||= e.returns ?? false;
  }
  return f;
}

function resolveParams(form: FormDef, fx: Folded, lin: number, depth: number): FormParams {
  const b = form.behavior;
  switch (b.form) {
    case 'bolt':
      return { form: 'bolt', speed: b.speed * fx.speedMult, life: b.life, radius: b.radius };
    case 'nova':
      return { form: 'nova', radius: b.radius * lin, expandTime: b.expandTime };
    case 'beam':
      return { form: 'beam', length: b.length, width: b.width };
    case 'lob':
      return {
        form: 'lob',
        range: b.range,
        flightTime: b.flightTime * fx.lobFlightTimeMult,
        burstRadius: b.burstRadius * lin,
        randomLandRadius: depth > 0 ? b.branchLandRadius : null,
      };
    case 'orb':
      return {
        form: 'orb',
        orbitRadius: b.orbitRadius,
        revolutionsPerSecond: b.revolutionsPerSecond,
        tickRotation: rotationDeg((360 * b.revolutionsPerSecond) / SIM_HZ),
        duration: b.duration * fx.durationMult,
        radius: b.radius * lin,
        hitInterval: b.hitInterval,
      };
    case 'strike':
      return {
        form: 'strike',
        arcDeg: b.arcDeg,
        halfAngleCos: rotationDeg(b.arcDeg / 2).cos,
        reach: b.reach * lin,
      };
    case 'swath':
      return { form: 'swath', length: b.length * lin, width: b.width * lin };
    case 'sigil':
      return { form: 'sigil', range: b.range, duration: b.duration * fx.durationMult };
  }
}

/**
 * Saturate's area mult scales radii by its square root; a beam's line keeps its length, so its
 * width takes the whole factor. The orb's trail also grows with the spell's own area (Wide).
 */
function resolveFootprint(form: FormDef, lin: number, terrainArea: number): ResolvedFootprint {
  const s = Math.sqrt(terrainArea);
  const fp = form.footprint;
  switch (fp.kind) {
    case 'impact':
      return { kind: 'impact', radius: fp.radius * s };
    case 'hit_shape':
      return { kind: 'hit_shape', scale: s };
    case 'line':
      return { kind: 'line', width: fp.width * terrainArea };
    case 'trail':
      return { kind: 'trail', radius: fp.radius * lin * s, interval: fp.interval };
    case 'none':
      return { kind: 'none' };
  }
}

function resolveProc(p: ProcDef, parent: FormDef, pierceOrChain: boolean): ProcRule {
  switch (p.kind) {
    case 'on_hit':
      return {
        kind: 'on_hit',
        maxProcsPerInstance: pierceOrChain ? p.maxProcsWithPierceOrChain : p.maxProcs,
        firstTargetOnly: p.areaFirstTargetOnly && parent.area,
      };
    case 'on_expire':
      return { kind: 'on_expire', maxProcsPerInstance: p.maxProcs };
    case 'on_kill':
      return { kind: 'on_kill' };
    case 'emit':
      return { kind: 'emit', interval: p.interval, aimRange: p.aimRange };
  }
}

function shareElements(eff: readonly EffectiveElement[]): ElementShare[] {
  return eff.map((e) => {
    const def: ElementDef = elements[e.id];
    return {
      element: e.id,
      damageType: def.damageType,
      share: 1 / eff.length,
      ailment: def.ailment,
      wetDuration: def.wetDuration ?? 0,
      source: e.source,
    };
  });
}

function sharesByType(list: readonly ElementShare[]): DamageAmounts {
  const out = Object.fromEntries(damageTypes.map((t) => [t, 0])) as DamageAmounts;
  if (list.length === 0) out.physical = 1;
  for (const e of list) out[e.damageType] += e.share;
  return out;
}
