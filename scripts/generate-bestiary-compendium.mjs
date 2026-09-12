import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const identity = (source, name) => `${source}\u0000${name}`;

function issue(diagnostics, issue) {
	diagnostics.push(issue);
}

function getType(monster) {
	return typeof monster.type === 'string' ? monster.type : monster.type?.type;
}

function getCr(monster) {
	return typeof monster.cr === 'object' && monster.cr ? monster.cr.cr : monster.cr;
}

function getItems(items) {
	return Array.isArray(items) ? items : [items];
}

function sameItem(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function replaceText(value, mod, diagnostics, record) {
	if (typeof mod.replace !== 'string' || typeof mod.with !== 'string') {
		issue(diagnostics, { kind: 'invalid-mod', id: record.id, mode: 'replaceTxt' });
		return { applied: false, value };
	}

	try {
		const flags = typeof mod.flags === 'string' ? mod.flags : '';
		const expression = new RegExp(mod.replace, flags.includes('g') ? flags : `${flags}g`);
		const visit = (current) => {
			if (typeof current === 'string') return current.replace(expression, mod.with);
			if (Array.isArray(current)) return current.map(visit);
			if (!isRecord(current)) return current;
			return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, visit(item)]));
		};
		return { applied: true, value: visit(value) };
	} catch {
		issue(diagnostics, { kind: 'invalid-mod', id: record.id, mode: 'replaceTxt' });
		return { applied: false, value };
	}
}

function applyArrayMod(target, mod, diagnostics, record) {
	if (target === undefined && ['appendArr', 'prependArr', 'appendIfNotExistsArr'].includes(mod.mode)) target = [];
	if (!Array.isArray(target)) {
		issue(diagnostics, { kind: 'mod-target-not-array', id: record.id, mode: mod.mode });
		return { applied: false, value: target };
	}

	const items = getItems(mod.items).filter((item) => item !== undefined);
	if (mod.mode === 'appendArr') return { applied: true, value: [...target, ...items] };
	if (mod.mode === 'prependArr') return { applied: true, value: [...items, ...target] };
	if (mod.mode === 'appendIfNotExistsArr') {
		return { applied: true, value: [...target, ...items.filter((item) => !target.some((entry) => sameItem(entry, item)))] };
	}

	if (mod.mode === 'removeArr') {
		const names = new Set(getItems(mod.names ?? mod.items).map(String));
		return {
			applied: true,
			value: target.filter((entry) => !names.has(String(isRecord(entry) ? entry.name : entry))),
		};
	}

	if (mod.mode === 'replaceArr') {
		const index = target.findIndex((entry) => String(isRecord(entry) ? entry.name : entry) === String(mod.replace));
		if (index < 0) {
			issue(diagnostics, { kind: 'mod-replacement-not-found', id: record.id, mode: mod.mode, replace: mod.replace });
			return { applied: false, value: target };
		}
		return { applied: true, value: [...target.slice(0, index), ...items, ...target.slice(index + 1)] };
	}

	return { applied: false, value: target };
}

function applySpellMod(monster, mod, diagnostics, record) {
	if (!Array.isArray(monster.spellcasting)) {
		issue(diagnostics, { kind: 'mod-target-not-array', id: record.id, mode: mod.mode });
		return false;
	}
	let applied = false;
	const sections = mod.spells ?? mod.daily ?? Object.fromEntries(Object.entries(mod).filter(([key]) => key !== 'mode'));
	for (const spellcasting of monster.spellcasting) {
		for (const [property, changes] of Object.entries(sections)) {
			const isSpellLevel = !!mod.spells;
			const container = isSpellLevel ? spellcasting.spells?.[property] : mod.daily ? spellcasting.daily?.[property] : spellcasting[property];
			const target = isSpellLevel ? container?.spells : mod.daily ? container : container;
			if (mod.mode === 'addSpells') {
				const additions = isSpellLevel ? changes.spells : changes;
				if (!Array.isArray(additions)) continue;
				if (isSpellLevel) {
					spellcasting.spells ??= {};
					spellcasting.spells[property] ??= { spells: [] };
					spellcasting.spells[property].spells ??= [];
					spellcasting.spells[property].spells.push(...clone(additions));
				} else if (mod.daily) {
					spellcasting.daily ??= {};
					spellcasting.daily[property] ??= [];
					spellcasting.daily[property].push(...clone(additions));
				} else {
					spellcasting[property] ??= [];
					spellcasting[property].push(...clone(additions));
				}
				applied = true;
				continue;
			}
			if (!Array.isArray(target)) continue;
			const replacements = getItems(changes);
			for (const change of replacements) {
				const match = mod.mode === 'removeSpells' ? change : change?.replace;
				const index = target.findIndex((spell) => spell === match);
				if (index < 0) continue;
				if (mod.mode === 'removeSpells') target.splice(index, 1);
				else if (typeof change.with === 'string') target[index] = change.with;
				else continue;
				applied = true;
			}
		}
	}
	if (!applied) issue(diagnostics, { kind: 'spell-modification-not-found', id: record.id, mode: mod.mode });
	return applied;
}

function applyMods(monster, mods, diagnostics, record) {
	let result = clone(monster);
	const unapplied = [];
	for (const [field, configuredMods] of Object.entries(mods ?? {})) {
		for (const mod of getItems(configuredMods)) {
			if (!isRecord(mod) || typeof mod.mode !== 'string') {
				issue(diagnostics, { kind: 'invalid-mod', id: record.id, field });
				unapplied.push({ field, mod });
				continue;
			}

			let outcome;
			if (mod.mode === 'replaceTxt') outcome = replaceText(field === '*' ? result : result[field], mod, diagnostics, record);
			else if (mod.mode === 'setProp' && typeof mod.prop === 'string') {
				result[mod.prop] = clone(mod.value);
				outcome = { applied: true, value: result[field] };
			} else if (mod.mode === 'addSkills' && isRecord(mod.skills)) {
				result.skill = { ...(result.skill ?? {}), ...clone(mod.skills) };
				outcome = { applied: true, value: result[field] };
			} else if (['addSpells', 'removeSpells', 'replaceSpells'].includes(mod.mode)) {
				outcome = { applied: applySpellMod(result, mod, diagnostics, record), value: result[field] };
			} else if (mod.mode === 'insertArr' && Array.isArray(result[field])) {
				const index = Number.isInteger(mod.index) ? mod.index : result[field].length;
				result[field].splice(Math.max(0, index), 0, ...getItems(mod.items));
				outcome = { applied: true, value: result[field] };
			} else outcome = applyArrayMod(result[field], mod, diagnostics, record);
			if (!outcome.applied) {
				issue(diagnostics, { kind: 'unsupported-mod', id: record.id, field, mode: mod.mode });
				unapplied.push({ field, mod });
				continue;
			}
			if (field === '*') result = outcome.value;
			else result[field] = outcome.value;
		}
	}
	return { monster: result, unapplied };
}

function sourceFileName(source) {
	return `${encodeURIComponent(source).toLowerCase()}.json`;
}

function extractFluffImages(entries) {
	if (!Array.isArray(entries)) return [];
	return entries.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.name !== 'string' || typeof entry.source !== 'string') return [];
		const image = Array.isArray(entry.images)
			? entry.images.find((candidate) => isRecord(candidate) && isRecord(candidate.href) && typeof candidate.href.path === 'string')
			: undefined;
		const path = isRecord(image) && isRecord(image.href) ? image.href.path : undefined;
		return typeof path === 'string'
			? [{ name: entry.name, source: entry.source, url: `https://5e.tools/img/${path.replace(/^\/+/, '')}` }]
			: [];
	});
}

function sourceImages(monsters, fluffImages) {
	const images = new Map(fluffImages.map((image) => [`${image.source}\u0000${image.name}`, image]));
	for (const monster of monsters) {
		if (!monster?.hasToken || typeof monster.name !== 'string' || typeof monster.source !== 'string') continue;
		const key = `${monster.source}\u0000${monster.name}`;
		if (images.has(key)) continue;
		images.set(key, {
			name: monster.name,
			source: monster.source,
			url: `https://5e.tools/img/bestiary/tokens/${encodeURIComponent(monster.source)}/${encodeURIComponent(monster.name)}.webp`,
		});
	}
	return [...images.values()];
}

function compactMonster(monster) {
	const indexEntry = { i: monster.id, n: monster.name, s: monster.source };
	const type = getType(monster);
	const cr = getCr(monster);
	if (type) indexEntry.t = type;
	if (Array.isArray(monster.size) && monster.size[0]) indexEntry.z = monster.size[0];
	if (cr !== undefined && cr !== null) indexEntry.cr = String(cr);
	if (monster.page !== undefined) indexEntry.p = monster.page;
	if (Array.isArray(monster.alias) && monster.alias.length) {
		indexEntry.a = monster.alias.filter((alias) => typeof alias === 'string');
	}
	const armorClass = Array.isArray(monster.ac) ? monster.ac[0] : undefined;
	if (typeof armorClass === 'number') indexEntry.ac = armorClass;
	else if (isRecord(armorClass) && typeof armorClass.ac === 'number') indexEntry.ac = armorClass.ac;
	if (isRecord(monster.hp) && typeof monster.hp.average === 'number') indexEntry.hp = monster.hp.average;
	if (Array.isArray(monster.spellcasting) && monster.spellcasting.length) indexEntry.sc = true;
	if (Array.isArray(monster.legendary) && monster.legendary.length) indexEntry.lg = true;
	if (monster.legendaryGroup) indexEntry.la = true;
	return indexEntry;
}

export function compileBestiary(sourceMonsters, legendaryGroups = [], fluffBySource = {}) {
	const diagnostics = [];
	const records = [];
	const lookup = new Map();
	const sourceOrder = Object.keys(sourceMonsters).sort((left, right) => left.localeCompare(right));

	for (const bundleSource of sourceOrder) {
		const monsters = sourceMonsters[bundleSource];
		if (!Array.isArray(monsters)) {
			issue(diagnostics, { kind: 'invalid-monster-list', source: bundleSource });
			continue;
		}
		for (const [position, raw] of monsters.entries()) {
			if (!isRecord(raw) || typeof raw.name !== 'string' || !raw.name.trim() || typeof raw.source !== 'string' || !raw.source.trim()) {
				issue(diagnostics, { kind: 'malformed-monster', source: bundleSource, position });
				continue;
			}
			const key = identity(raw.source, raw.name);
			const duplicate = lookup.has(key);
			const id = `${raw.source}:${encodeURIComponent(raw.name.toLowerCase())}${duplicate ? `:${position + 1}` : ''}`;
			const record = { id, bundleSource, raw: clone(raw), key };
			if (duplicate) issue(diagnostics, { kind: 'duplicate-monster', source: raw.source, name: raw.name, id });
			else lookup.set(key, record);
			records.push(record);
		}
	}

	const resolved = new Map();
	function resolveRecord(record, trail = []) {
		if (resolved.has(record.id)) return clone(resolved.get(record.id));
		if (trail.includes(record.id)) {
			issue(diagnostics, { kind: 'copy-cycle', id: record.id, trail: [...trail, record.id] });
			return null;
		}

		const raw = record.raw;
		if (!isRecord(raw._copy)) {
			const monster = { ...clone(raw), id: record.id };
			resolved.set(record.id, monster);
			return clone(monster);
		}

		const copy = raw._copy;
		const copySource = typeof copy.source === 'string' ? copy.source : raw.source;
		const base = typeof copy.name === 'string' ? lookup.get(identity(copySource, copy.name)) : undefined;
		if (!base) {
			issue(diagnostics, { kind: 'unresolved-copy', id: record.id, name: copy.name, source: copySource });
			const monster = { ...clone(raw), id: record.id, _compile: { status: 'unresolved-copy', copy: clone(copy) } };
			resolved.set(record.id, monster);
			return clone(monster);
		}

		const inherited = resolveRecord(base, [...trail, record.id]);
		if (!inherited) {
			issue(diagnostics, { kind: 'unresolved-copy', id: record.id, name: copy.name, source: copySource });
			const monster = { ...clone(raw), id: record.id, _compile: { status: 'unresolved-copy', copy: clone(copy) } };
			resolved.set(record.id, monster);
			return clone(monster);
		}

		delete inherited.id;
		delete inherited._compile;
		const { _copy, ...overrides } = clone(raw);
		const { monster: modified, unapplied } = applyMods(inherited, copy._mod, diagnostics, record);
		const compile = { status: unapplied.length ? 'partially-resolved' : 'resolved-copy', copy: { name: copy.name, source: copySource } };
		if (copy._templates) compile.templates = clone(copy._templates);
		if (copy._preserve) compile.preserve = clone(copy._preserve);
		if (unapplied.length) compile.unappliedMods = unapplied;
		const monster = { ...modified, ...overrides, id: record.id, _compile: compile };
		resolved.set(record.id, monster);
		return clone(monster);
	}

	const bundles = new Map(sourceOrder.map((source) => [source, []]));
	for (const record of records) {
		const monster = resolveRecord(record);
		if (!bundles.has(record.bundleSource)) bundles.set(record.bundleSource, []);
		bundles.get(record.bundleSource).push(monster);
	}

	for (const monsters of bundles.values()) monsters.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
	const sources = [...bundles.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([source, monsters]) => ({ s: source, f: `sources/${sourceFileName(source)}`, c: monsters.length }));
	const monsters = [...bundles.values()].flat().map(compactMonster).sort((left, right) => left.n.localeCompare(right.n) || left.s.localeCompare(right.s));
	return {
		index: { schema: 1, sources, monsters, diagnostics },
		bundles,
		legendaryGroups: Array.isArray(legendaryGroups) ? clone(legendaryGroups) : [],
		fluffImages: Object.fromEntries(sourceOrder.map((source) => [source, extractFluffImages(fluffBySource[source])])),
	};
}

export async function readRawBestiary(rawDirectory) {
	const diagnostics = [];
	let index;
	try {
		index = JSON.parse(await readFile(join(rawDirectory, 'index.json'), 'utf8'));
	} catch (error) {
		throw new Error(`Unable to read bestiary index: ${error.message}`);
	}
	if (!isRecord(index)) throw new Error('Bestiary index must be an object.');

	const sourceMonsters = {};
	for (const [source, file] of Object.entries(index)) {
		if (typeof file !== 'string' || basename(file) !== file) {
			issue(diagnostics, { kind: 'invalid-source-file', source, file });
			continue;
		}
		try {
			const data = JSON.parse(await readFile(join(rawDirectory, file), 'utf8'));
			sourceMonsters[source] = data.monster;
		} catch (error) {
			issue(diagnostics, { kind: 'unreadable-source-file', source, file, message: error.message });
		}
	}
	let legendaryGroups = [];
	try {
		const data = JSON.parse(await readFile(join(rawDirectory, 'legendarygroups.json'), 'utf8'));
		legendaryGroups = Array.isArray(data.legendaryGroup) ? data.legendaryGroup : [];
	} catch (error) {
		issue(diagnostics, { kind: 'unreadable-legendary-groups', message: error.message });
	}
	const fluffBySource = {};
	try {
		const fluffIndex = JSON.parse(await readFile(join(rawDirectory, 'fluff-index.json'), 'utf8'));
		if (isRecord(fluffIndex)) {
			for (const [source, file] of Object.entries(fluffIndex)) {
				if (typeof file !== 'string' || basename(file) !== file) continue;
				try {
					const data = JSON.parse(await readFile(join(rawDirectory, file), 'utf8'));
					fluffBySource[source] = Array.isArray(data.monsterFluff) ? data.monsterFluff : [];
				} catch (error) {
					issue(diagnostics, { kind: 'unreadable-fluff-file', source, message: error.message });
				}
			}
		}
	} catch (error) {
		issue(diagnostics, { kind: 'unreadable-fluff-index', message: error.message });
	}
	return { sourceMonsters, legendaryGroups, fluffBySource, diagnostics };
}

export async function generateBestiary({ rawDirectory, outputDirectory }) {
	const raw = await readRawBestiary(rawDirectory);
	const compiled = compileBestiary(raw.sourceMonsters, raw.legendaryGroups, raw.fluffBySource);
	compiled.index.diagnostics.unshift(...raw.diagnostics);
	const temporaryDirectory = `${outputDirectory}.tmp`;
	await rm(temporaryDirectory, { recursive: true, force: true });
	await mkdir(join(temporaryDirectory, 'sources'), { recursive: true });
	await writeFile(join(temporaryDirectory, 'index.json'), JSON.stringify(compiled.index));
	for (const [source, monsters] of compiled.bundles) {
		await writeFile(
			join(temporaryDirectory, 'sources', sourceFileName(source)),
			JSON.stringify({
				schema: 1,
				source,
				monsters,
				legendaryGroup: compiled.legendaryGroups,
				images: sourceImages(monsters, compiled.fluffImages[source] ?? []),
			}),
		);
	}
	await rm(outputDirectory, { recursive: true, force: true });
	await mkdir(dirname(outputDirectory), { recursive: true });
	await rename(temporaryDirectory, outputDirectory);
	return compiled.index;
}

export async function validateGeneratedBestiary(outputDirectory) {
	const index = JSON.parse(await readFile(join(outputDirectory, 'index.json'), 'utf8'));
	if (!isRecord(index) || index.schema !== 1 || !Array.isArray(index.sources) || !Array.isArray(index.monsters)) {
		throw new Error('Bestiary index has an invalid schema.');
	}
	const indexIds = new Set(index.monsters.map((monster) => monster.i));
	if (indexIds.size !== index.monsters.length) throw new Error('Bestiary index contains duplicate monster IDs.');
	let bundleCount = 0;
	for (const source of index.sources) {
		const bundle = JSON.parse(await readFile(join(outputDirectory, source.f), 'utf8'));
		if (bundle.source !== source.s || !Array.isArray(bundle.monsters) || bundle.monsters.length !== source.c) {
			throw new Error(`Bestiary bundle ${source.s} does not match its index entry.`);
		}
		bundleCount += bundle.monsters.length;
		for (const monster of bundle.monsters) {
			if (!isRecord(monster) || typeof monster.id !== 'string' || !indexIds.has(monster.id)) {
				throw new Error(`Bestiary bundle ${source.s} contains an unindexed monster.`);
			}
		}
	}
	if (bundleCount !== index.monsters.length) throw new Error('Bestiary bundle and index counts differ.');
	return { sources: index.sources.length, monsters: bundleCount, diagnostics: index.diagnostics.length };
}

async function main() {
	const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
	const outputDirectory = join(root, 'public', 'compendium', 'bestiary');
	if (process.argv.includes('--validate')) {
		const report = await validateGeneratedBestiary(outputDirectory);
		console.log(`Validated ${report.monsters} monsters in ${report.sources} source bundles (${report.diagnostics} diagnostics).`);
		return;
	}
	const index = await generateBestiary({ rawDirectory: join(root, 'rpg_files', '5etools-2014', 'bestiary'), outputDirectory });
	console.log(`Generated ${index.monsters.length} monsters in ${index.sources.length} source bundles (${index.diagnostics.length} diagnostics).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
	console.error(error.stack || error.message);
	process.exitCode = 1;
});
