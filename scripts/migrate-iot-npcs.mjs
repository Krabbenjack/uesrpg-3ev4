import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'template.json');
const NPC_DIR = path.join(REPO_ROOT, 'packs', 'src', 'inhabitants-of-tamriel');

const CHARACTERISTICS = ['str', 'end', 'agi', 'int', 'wp', 'prc', 'prs', 'lck'];
const SPECIAL_SKILLS = ['profession1', 'profession2', 'profession3', 'commerce'];

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map((v) => deepClone(v));
  if (isObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
    return out;
  }
  return value;
}

function getAt(obj, pathParts) {
  let cur = obj;
  for (const part of pathParts) {
    if (!isObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setAt(obj, pathParts, value) {
  let cur = obj;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    const part = pathParts[i];
    if (!isObject(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[pathParts[pathParts.length - 1]] = value;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function preserveTrailingNewlines(original, updated) {
  const originalCount = (original.match(/\n*$/)?.[0] ?? '').length;
  const updatedBody = updated.replace(/\n*$/, '');
  return `${updatedBody}${'\n'.repeat(originalCount)}`;
}

function collectSystemUpdates(system, npcTemplate) {
  const updates = [];

  const queueSet = (pathParts, value) => {
    const current = getAt(system, pathParts);
    if (!sameValue(current, value)) {
      updates.push({ path: pathParts, value: deepClone(value) });
      setAt(system, pathParts, deepClone(value));
    }
  };

  const ensureFromTemplate = (basePath, templateValue) => {
    if (!isObject(templateValue)) return;
    const current = getAt(system, basePath);
    if (!isObject(current)) return;

    for (const [key, childTemplate] of Object.entries(templateValue)) {
      if (key === 'templates') continue;
      const childPath = [...basePath, key];
      const childCurrent = getAt(system, childPath);

      if (childCurrent === undefined) {
        queueSet(childPath, deepClone(childTemplate));
      } else if (isObject(childTemplate) && isObject(childCurrent)) {
        ensureFromTemplate(childPath, childTemplate);
      }
    }
  };

  ensureFromTemplate([], npcTemplate);

  const templateChars = npcTemplate.characteristics ?? {};
  for (const charKey of CHARACTERISTICS) {
    const charTemplate = templateChars[charKey] ?? { value: 0, total: 0, base: 0, favored: false };
    const charPath = ['characteristics', charKey];
    if (!isObject(getAt(system, charPath))) queueSet(charPath, deepClone(charTemplate));

    const base = toNumber(getAt(system, [...charPath, 'base']), toNumber(charTemplate.base, 0));
    const value = toNumber(getAt(system, [...charPath, 'value']), base);
    const total = toNumber(getAt(system, [...charPath, 'total']), base);
    const favored = Boolean(getAt(system, [...charPath, 'favored']));

    queueSet([...charPath, 'base'], base);
    queueSet([...charPath, 'value'], value);
    queueSet([...charPath, 'total'], total);
    queueSet([...charPath, 'favored'], favored);
  }

  const skillsTemplate = npcTemplate.skills ?? {};
  for (const skillKey of SPECIAL_SKILLS) {
    const skillTemplate = skillsTemplate[skillKey] ?? { rank: '', bonus: 0, specialization: '', characteristic: '', tn: 0 };
    const skillPath = ['skills', skillKey];
    if (!isObject(getAt(system, skillPath))) queueSet(skillPath, deepClone(skillTemplate));

    const rank = getAt(system, [...skillPath, 'rank']);
    if (rank === undefined || rank === null) queueSet([...skillPath, 'rank'], skillTemplate.rank ?? '');

    const specialization = getAt(system, [...skillPath, 'specialization']);
    if (specialization === undefined || specialization === null) queueSet([...skillPath, 'specialization'], skillTemplate.specialization ?? '');

    const characteristic = getAt(system, [...skillPath, 'characteristic']);
    if (characteristic === undefined || characteristic === null) queueSet([...skillPath, 'characteristic'], skillTemplate.characteristic ?? '');

    queueSet([...skillPath, 'bonus'], toNumber(getAt(system, [...skillPath, 'bonus']), toNumber(skillTemplate.bonus, 0)));
    queueSet([...skillPath, 'tn'], toNumber(getAt(system, [...skillPath, 'tn']), toNumber(skillTemplate.tn, 0)));
  }

  const normalizeNumberMap = (containerKey, fieldsTemplate) => {
    const containerPath = [containerKey];
    if (!isObject(getAt(system, containerPath))) queueSet(containerPath, deepClone(fieldsTemplate));

    for (const [key, fallbackVal] of Object.entries(fieldsTemplate)) {
      if (isObject(fallbackVal)) continue;
      if (typeof fallbackVal !== 'number') continue;
      const fieldPath = [...containerPath, key];
      queueSet(fieldPath, toNumber(getAt(system, fieldPath), fallbackVal));
    }
  };

  normalizeNumberMap('professions', npcTemplate.professions ?? {});
  normalizeNumberMap('professionsWound', npcTemplate.professionsWound ?? {});

  const numericContainers = {
    hp: ['base', 'value', 'max', 'temp', 'bonus'],
    stamina: ['value', 'max', 'bonus'],
    magicka: ['value', 'max', 'bonus'],
    luck_points: ['value', 'max', 'bonus'],
    wound_threshold: ['value', 'base', 'bonus'],
    initiative: ['value', 'base', 'bonus'],
    speed: ['value', 'base', 'bonus'],
    carry_rating: ['current', 'max', 'bonus', 'penalty'],
    action_points: ['value', 'max'],
    resistance: ['fireR', 'frostR', 'shockR', 'magicR', 'poisonR', 'diseaseR', 'natToughness', 'silverR', 'sunlightR', 'physicalR']
  };

  for (const [containerKey, fields] of Object.entries(numericContainers)) {
    const templateContainer = npcTemplate[containerKey] ?? {};
    const containerPath = [containerKey];
    if (!isObject(getAt(system, containerPath))) queueSet(containerPath, deepClone(templateContainer));

    for (const field of fields) {
      const fallback = toNumber(templateContainer[field], 0);
      const fieldPath = [...containerPath, field];
      queueSet(fieldPath, toNumber(getAt(system, fieldPath), fallback));
    }
  }

  queueSet(['tempHP'], toNumber(getAt(system, ['tempHP']), toNumber(npcTemplate.tempHP, 0)));

  return updates;
}

async function run() {
  const templateJson = JSON.parse(await readFile(TEMPLATE_PATH, 'utf8'));
  const npcTemplate = templateJson?.Actor?.NPC;

  if (!isObject(npcTemplate)) throw new Error('Could not read Actor.NPC template from template.json');

  const entries = await readdir(NPC_DIR, { withFileTypes: true });
  let touched = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.yml')) continue;

    const filePath = path.join(NPC_DIR, entry.name);
    const original = await readFile(filePath, 'utf8');
    const doc = YAML.parseDocument(original, { keepSourceTokens: true });
    const actor = doc.toJS();

    if (!isObject(actor) || actor.type !== 'NPC' || !isObject(actor.system)) {
      skipped += 1;
      continue;
    }

    const updates = collectSystemUpdates(actor.system, npcTemplate);
    if (updates.length === 0) continue;

    for (const { path: pathParts, value } of updates) {
      doc.setIn(['system', ...pathParts], value);
    }

    const updated = preserveTrailingNewlines(original, String(doc));
    if (updated !== original) {
      await writeFile(filePath, updated, 'utf8');
      touched += 1;
    }
  }

  console.log(`Migration complete. Updated ${touched} NPC YAML file(s); skipped ${skipped} non-NPC file(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
