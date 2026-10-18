/** The spell language: notation, tree, compiler and the SpellProgram the runtime runs. */
export {
  parseWeave,
  printWeave,
  printSpell,
  canonicalWeave,
  type ParseError,
  type ParseResult,
} from './notation';
export {
  spellAt,
  runeAt,
  parentBranch,
  childPath,
  pathDepth,
  walkSpells,
  listSpells,
  updateSpell,
  branchIndex,
  type WeaveTree,
  type SpellNode,
  type BranchNode,
  type WeavePath,
  type SpellVisit,
} from './tree';
export { compileWeave, type CompileResult, type CompileError } from './compile';
export { spindleContext, resolveContext, type CompileContext, type ResolvedContext } from './context';
export { weaveCostsOf, spellMana, ownMana, weaveComplexity, branchComplexity } from './costs';
export { rotationDeg, fanRotations, IDENTITY_ROTATION, type Rotation } from './angles';
export { specPacket } from './packet';
export {
  referenceWeaves,
  mustFailWeaves,
  capacityMessage,
  type ReferenceWeave,
  type MustFailWeave,
} from './referenceWeaves';
export type * from './program';
