import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packDir = path.join(repoRoot, 'packs', 'src', 'inhabitants-of-tamriel');
const templatePath = path.join(repoRoot, 'template.json');
const packagePath = path.join(repoRoot, 'package.json');
const checkOnly = process.argv.includes('--check');

const CHARACTERISTIC_KEYS = ['str', 'end', 'agi', 'int', 'wp', 'prc', 'prs', 'lck'];
const PROFESSION_KEYS = ['combat', 'magic', 'evade', 'observe', 'stealth', 'knowledge', 'social', 'physical', 'commerce', 'profession1', 'profession2', 'profession3'];
const SPECIAL_SKILL_KEYS = ['profession1', 'profession2', 'profession3', 'commerce'];
const STRING_FIELDS = ['race', 'birthsign', 'age', 'height', 'weight', 'elite_adv', 'bio', 'paperDoll', 'soul_energy', 'journal', 'notes', 'threat', 'supply', 'talents', 'traits', 'powers', 'spells', 'armor_class', 'storeName'];
const DEFAULT_SIZE_CAT = {
  puny: 'Puny',
  tiny: 'Tiny',
  small: 'Small',
  standard: 'Standard',
  large: 'Large',
  huge: 'Huge',
  enormous: 'Enormous'
};
const DEFAULT_ARMOR_CLASS_CAT = {
  none: 'None',
  super_light: 'Super Light',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
  super_heavy: 'Super Heavy'
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function coerceNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const coerced = Number(trimmed);
    if (Number.isFinite(coerced)) return coerced;
  }
  return fallback;
}

function coerceString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function ensureObject(target, key, fallback = {}) {
  if (!isObject(target[key])) target[key] = clone(fallback);
  return target[key];
}

function ensureBoolean(target, key, fallback = false) {
  if (typeof target[key] !== 'boolean') target[key] = fallback;
}

function ensureNumber(target, key, fallback = 0) {
  target[key] = coerceNumber(target[key], fallback);
}

function mergeDefaults(target, defaults) {
  if (!isObject(target) || !isObject(defaults)) return target;
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in target)) {
      target[key] = clone(value);
      continue;
    }
    if (isObject(value)) {
      if (!isObject(target[key])) {
        target[key] = clone(value);
      } else {
        mergeDefaults(target[key], value);
      }
    }
  }
  return target;
}

async function loadJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function buildNpcDefaults(templateJson) {
  const npc = templateJson.Actor?.NPC ?? {};
  return {
    threatCategory: clone(npc.threatCategory ?? {}),
    resistance: clone(npc.resistance ?? {}),
    resistances: clone(npc.resistances ?? {}),
    traits: clone(npc.traits ?? {}),
    recovery: clone(npc.recovery ?? {}),
    resources: clone(npc.resources ?? {}),
    movement: clone(npc.movement ?? {}),
    senses: clone(npc.senses ?? {}),
    lucky_numbers: clone(npc.lucky_numbers ?? {}),
    unlucky_numbers: clone(npc.unlucky_numbers ?? {}),
    supply_cat: clone(npc.supply_cat ?? {}),
    size_cat: clone(npc.size_cat ?? DEFAULT_SIZE_CAT),
    armor_class_cat: clone(npc.armor_class_cat ?? DEFAULT_ARMOR_CLASS_CAT),
    modifiers: clone(npc.modifiers ?? {}),
    skill_ranks: clone(npc.skill_ranks ?? {}),
    combat_tracking: clone(templateJson.Actor?.templates?.combatTracking?.combat_tracking ?? {})
  };
}

function normalizeCharacteristics(system) {
  const characteristics = ensureObject(system, 'characteristics');
  for (const key of CHARACTERISTIC_KEYS) {
    const entry = ensureObject(characteristics, key);
    const fallback = coerceNumber(entry.value, coerceNumber(entry.base, coerceNumber(entry.total, 0)));
    entry.value = coerceNumber(entry.value, fallback);
    entry.base = coerceNumber(entry.base, fallback);
    entry.total = coerceNumber(entry.total, fallback);
    entry.bonus = coerceNumber(entry.bonus, 0);
    entry.favored = typeof entry.favored === 'boolean' ? entry.favored : false;
  }
}

function normalizeProfessions(system) {
  const professions = ensureObject(system, 'professions');
  const professionsWound = ensureObject(system, 'professionsWound');

  for (const key of PROFESSION_KEYS) {
    professions[key] = coerceNumber(professions[key], 0);
    professionsWound[key] = coerceNumber(professionsWound[key], 0);
  }
}

function normalizeSpecialSkills(system) {
  const skills = ensureObject(system, 'skills');
  for (const key of SPECIAL_SKILL_KEYS) {
    const entry = ensureObject(skills, key);
    entry.rank = coerceString(entry.rank, '');
    entry.bonus = coerceNumber(entry.bonus, 0);
    entry.specialization = coerceString(entry.specialization, '');
    entry.characteristic = coerceString(entry.characteristic, '');
    entry.tn = coerceNumber(entry.tn, 0);
    if ('name' in entry || key !== 'commerce') {
      entry.name = coerceString(entry.name, '');
    }
  }
}

function normalizeCoreResources(system) {
  for (const [key, defaults] of Object.entries({
    hp: { base: 0, value: 0, max: 0, temp: 0, bonus: 0 },
    action_points: { value: 0, max: 3 },
    luck_points: { value: 0, max: 0, bonus: 0 },
    stamina: { value: 0, max: 0, bonus: 0 },
    magicka: { value: 0, max: 0, bonus: 0 },
    wound_threshold: { value: 0, base: 0, bonus: 0 },
    initiative: { value: 0, base: 0, bonus: 0 },
    speed: { value: 0, base: 0, bonus: 0, swimSpeed: 0, flySpeed: 0 },
    carry_rating: { current: 0, max: 0, bonus: 0, penalty: 0, label: 'Minimal' },
    fatigue: { level: 0, penalty: 0, bonus: 0 }
  })) {
    const entry = ensureObject(system, key, defaults);
    mergeDefaults(entry, defaults);
    for (const [field, value] of Object.entries(defaults)) {
      if (typeof value === 'number') {
        entry[field] = coerceNumber(entry[field], value);
      } else if (typeof value === 'string') {
        entry[field] = coerceString(entry[field], value);
      }
    }
  }

  system.tempHP = coerceNumber(system.tempHP, 0);
  system.current_enc = coerceNumber(system.current_enc, 0);
  system.xp = coerceNumber(system.xp, 0);
  system.wealth = coerceNumber(system.wealth, 0);
  system.priceMod = coerceNumber(system.priceMod, 0);
  system.fatigueLevel = coerceNumber(system.fatigueLevel, 0);
  system.woundPenalty = coerceNumber(system.woundPenalty, 0);
}

function normalizeMiscFields(system, defaults) {
  for (const field of STRING_FIELDS) {
    system[field] = coerceString(system[field], '');
  }

  ensureBoolean(system, 'wounded', false);
  mergeDefaults(system, {
    threatCategory: defaults.threatCategory,
    resistance: defaults.resistance,
    resistances: defaults.resistances,
    traits: defaults.traits,
    recovery: defaults.recovery,
    resources: defaults.resources,
    movement: defaults.movement,
    senses: defaults.senses,
    lucky_numbers: defaults.lucky_numbers,
    unlucky_numbers: defaults.unlucky_numbers,
    supply_cat: defaults.supply_cat,
    size_cat: defaults.size_cat,
    armor_class_cat: defaults.armor_class_cat,
    combat_tracking: defaults.combat_tracking,
    modifiers: defaults.modifiers,
    skill_ranks: defaults.skill_ranks,
    mobility: {
      armorWeightClass: 'none',
      agilityTestPenalty: 0,
      agilityPenaltyExemptSkills: ['combatstyle', 'combat_style', 'combat style'],
      speedPenalty: 0,
      sources: []
    }
  });

  ensureNumber(system.mobility, 'agilityTestPenalty', 0);
  ensureNumber(system.mobility, 'speedPenalty', 0);
  system.mobility.armorWeightClass = coerceString(system.mobility.armorWeightClass, 'none');
  if (!Array.isArray(system.mobility.agilityPenaltyExemptSkills)) {
    system.mobility.agilityPenaltyExemptSkills = ['combatstyle', 'combat_style', 'combat style'];
  }
  if (!Array.isArray(system.mobility.sources)) {
    system.mobility.sources = [];
  }

  for (const key of Object.keys(system.combat_tracking)) {
    ensureNumber(system.combat_tracking, key, 0);
  }

  const modifierDefaults = {
    characteristics: {},
    skills: {},
    hp: { base: 0, bonus: 0, max: 0, value: 0 },
    magicka: { base: 0, bonus: 0, max: 0, value: 0 },
    stamina: { base: 0, bonus: 0, max: 0, value: 0 },
    luck_points: { base: 0, bonus: 0, max: 0, value: 0 },
    combat: { attackTN: 0, defenseTN: { total: 0, evade: 0, block: 0, parry: 0, counter: 0 } },
    tests: { all: 0 }
  };
  mergeDefaults(system.modifiers, modifierDefaults);

  for (const key of ['fireR', 'frostR', 'shockR', 'magicR', 'poisonR', 'diseaseR', 'natToughness', 'silverR', 'sunlightR', 'physicalR']) {
    system.resistance[key] = coerceNumber(system.resistance[key], 0);
  }

  for (const [containerKey, keys] of Object.entries({
    resistances: ['disease', 'poison', 'paralysis', 'bleed', 'fear', 'magic'],
    movement: ['speedBonus'],
    senses: ['nightSightBonus']
  })) {
    for (const key of keys) {
      system[containerKey][key] = coerceNumber(system[containerKey][key], 0);
    }
  }

  ensureNumber(system.movement.fallDamage, 'multiplier', 1);
  if (typeof system.movement.ignoreDifficultTerrain !== 'boolean') {
    system.movement.ignoreDifficultTerrain = false;
  }

  for (const key of ['lowLightVision', 'darkvision']) {
    if (typeof system.senses[key] !== 'boolean') {
      system.senses[key] = false;
    }
  }

  for (const resourceKey of ['magicka', 'stamina', 'health']) {
    ensureNumber(system.resources[resourceKey], 'maxBonus', 0);
  }

  ensureNumber(system.recovery.naturalHealing, 'multiplier', 1);
  ensureNumber(system.recovery.naturalHealing, 'flatBonus', 0);
  ensureNumber(system.recovery.magickaRecovery, 'multiplier', 1);
  ensureNumber(system.recovery.staminaRecovery, 'multiplier', 1);

  for (const [containerKey, keys] of Object.entries({
    lucky_numbers: ['ln1', 'ln2', 'ln3', 'ln4', 'ln5', 'ln6', 'ln7', 'ln8', 'ln9', 'ln10'],
    unlucky_numbers: ['ul1', 'ul2', 'ul3', 'ul4', 'ul5', 'ul6']
  })) {
    for (const key of keys) {
      system[containerKey][key] = coerceNumber(system[containerKey][key], 0);
    }
  }
}

function migrateNpc(actor, defaults, systemVersion) {
  if (actor?.type !== 'NPC') return false;
  const original = JSON.stringify(actor);
  const system = ensureObject(actor, 'system');

  normalizeCharacteristics(system);
  normalizeProfessions(system);
  normalizeSpecialSkills(system);
  normalizeCoreResources(system);
  normalizeMiscFields(system, defaults);

  system.size = coerceString(system.size, '');
  system.armor_class = coerceString(system.armor_class, '');

  if (isObject(actor._stats)) {
    actor._stats.systemVersion = systemVersion;
  }

  return JSON.stringify(actor) !== original;
}

function dumpYaml(data) {
  return yaml.dump(data, {
    noRefs: true,
    sortKeys: false,
    lineWidth: -1,
    quotingType: "'"
  });
}

async function main() {
  const templateJson = await loadJson(templatePath);
  const packageJson = await loadJson(packagePath);
  const defaults = buildNpcDefaults(templateJson);
  const files = (await fs.readdir(packDir)).filter((file) => file.endsWith('.yml')).sort();

  let changed = 0;
  let checked = 0;

  for (const file of files) {
    const filePath = path.join(packDir, file);
    const source = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(source);
    if (!isObject(data) || data.type !== 'NPC') continue;
    checked += 1;

    const didChange = migrateNpc(data, defaults, packageJson.version);
    if (!didChange) continue;

    changed += 1;
    if (!checkOnly) {
      await fs.writeFile(filePath, dumpYaml(data), 'utf8');
    }
  }

  const modeLabel = checkOnly ? 'would update' : 'updated';
  console.log(`Checked ${checked} NPC YAML files; ${modeLabel} ${changed}.`);
  if (checkOnly && changed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
