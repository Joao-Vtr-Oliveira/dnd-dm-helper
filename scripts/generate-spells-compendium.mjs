import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
const identity = (source, name) => `${source}\u0000${name}`;

function sourceFileName(source) {
	return `${encodeURIComponent(source).replace(/%/g, '_')}.json`;
}

function string(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function strings(value) {
	return Array.isArray(value)
		? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
		: [];
}

function integer(value) {
	return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function formatTime(time) {
	const first = Array.isArray(time) ? time[0] : null;
	if (!isRecord(first) || typeof first.number !== 'number' || !string(first.unit)) return undefined;
	const unit = first.number === 1 ? first.unit : `${first.unit}s`;
	return [`${first.number} ${unit}`, string(first.condition)].filter(Boolean).join(', ');
}

function formatRange(range) {
	if (!isRecord(range)) return undefined;
	if (range.type === 'special') return 'Special';
	const distance = isRecord(range.distance) ? range.distance : null;
	const type = string(distance?.type);
	if (!type) return string(range.type);
	if (['self', 'touch', 'sight', 'unlimited'].includes(type))
		return type[0].toUpperCase() + type.slice(1);
	const amount = typeof distance.amount === 'number' ? `${distance.amount} ` : '';
	const unit = type === 'feet' ? 'ft.' : type;
	return `${amount}${unit}`.trim();
}

function hasConcentration(duration) {
	return (
		Array.isArray(duration) &&
		duration.some((item) => isRecord(item) && item.concentration === true)
	);
}

function classNames(value) {
	if (!isRecord(value)) return [];
	const entries = [
		...(Array.isArray(value.class) ? value.class : []),
		...(Array.isArray(value.classVariant) ? value.classVariant : []),
	];
	return [
		...new Set(
			entries.map((entry) => string(isRecord(entry) ? entry.name : undefined)).filter(Boolean),
		),
	];
}

function compactSpell(spell, classes) {
	return {
		i: spell.id,
		n: spell.name,
		s: spell.source,
		p: spell.page,
		l: spell.level,
		h: spell.school,
		rt: spell.meta?.ritual === true,
		ct: hasConcentration(spell.duration),
		tm: formatTime(spell.time),
		rg: formatRange(spell.range),
		a: strings(spell.alias),
		cl: classNames(classes[spell.name]),
	};
}

export function compileSpells(sourceSpells, classSources = {}) {
	const diagnostics = [];
	const bundles = new Map();
	const seen = new Set();
	for (const [indexedSource, candidates] of Object.entries(sourceSpells)) {
		if (!Array.isArray(candidates)) {
			diagnostics.push({ kind: 'invalid-source-spells', source: indexedSource });
			continue;
		}
		for (const candidate of candidates) {
			if (!isRecord(candidate)) {
				diagnostics.push({ kind: 'invalid-spell', source: indexedSource });
				continue;
			}
			const name = string(candidate.name);
			const source = string(candidate.source);
			const level = integer(candidate.level);
			const school = string(candidate.school);
			if (
				!name ||
				!source ||
				level === undefined ||
				level < 0 ||
				!school ||
				!Array.isArray(candidate.entries)
			) {
				diagnostics.push({ kind: 'invalid-spell', source: indexedSource, name: candidate.name });
				continue;
			}
			const key = identity(source, name);
			if (seen.has(key)) {
				diagnostics.push({ kind: 'duplicate-spell', source, name });
				continue;
			}
			seen.add(key);
			const spell = {
				...clone(candidate),
				id: `${source}:${encodeURIComponent(name.toLocaleLowerCase())}`,
			};
			if (!bundles.has(source)) bundles.set(source, []);
			bundles.get(source).push(spell);
		}
	}

	for (const spells of bundles.values()) {
		spells.sort(
			(left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
		);
	}
	const sources = [...bundles.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([source, spells]) => ({
			s: source,
			f: `sources/${sourceFileName(source)}`,
			c: spells.length,
		}));
	const spells = [...bundles.values()]
		.flat()
		.map((spell) => compactSpell(spell, classSources[spell.source] ?? {}))
		.sort((left, right) => left.n.localeCompare(right.n) || left.s.localeCompare(right.s));
	return { index: { schema: 1, sources, spells, diagnostics }, bundles, classSources };
}

export async function readRawSpells(rawDirectory) {
	const diagnostics = [];
	let index;
	try {
		index = JSON.parse(await readFile(join(rawDirectory, 'index.json'), 'utf8'));
	} catch (error) {
		throw new Error(`Unable to read spells index: ${error.message}`);
	}
	if (!isRecord(index)) throw new Error('Spells index must be an object.');
	const sourceSpells = {};
	for (const [source, file] of Object.entries(index)) {
		if (typeof file !== 'string' || basename(file) !== file) {
			diagnostics.push({ kind: 'invalid-source-file', source, file });
			continue;
		}
		try {
			const data = JSON.parse(await readFile(join(rawDirectory, file), 'utf8'));
			sourceSpells[source] = data.spell;
		} catch (error) {
			diagnostics.push({ kind: 'unreadable-source-file', source, file, message: error.message });
		}
	}
	let classSources = {};
	try {
		const data = JSON.parse(await readFile(join(rawDirectory, 'sources.json'), 'utf8'));
		classSources = isRecord(data) ? data : {};
	} catch (error) {
		diagnostics.push({ kind: 'unreadable-class-sources', message: error.message });
	}
	return { sourceSpells, classSources, diagnostics };
}

export async function generateSpells({ rawDirectory, outputDirectory }) {
	const raw = await readRawSpells(rawDirectory);
	const compiled = compileSpells(raw.sourceSpells, raw.classSources);
	compiled.index.diagnostics.unshift(...raw.diagnostics);
	const temporaryDirectory = `${outputDirectory}.tmp`;
	await rm(temporaryDirectory, { recursive: true, force: true });
	await mkdir(join(temporaryDirectory, 'sources'), { recursive: true });
	await writeFile(join(temporaryDirectory, 'index.json'), JSON.stringify(compiled.index));
	for (const [source, spells] of compiled.bundles) {
		await writeFile(
			join(temporaryDirectory, 'sources', sourceFileName(source)),
			JSON.stringify({ schema: 1, source, spells, classes: compiled.classSources[source] ?? {} }),
		);
	}
	await rm(outputDirectory, { recursive: true, force: true });
	await mkdir(dirname(outputDirectory), { recursive: true });
	await rename(temporaryDirectory, outputDirectory);
	return compiled.index;
}

export async function validateGeneratedSpells(outputDirectory) {
	const index = JSON.parse(await readFile(join(outputDirectory, 'index.json'), 'utf8'));
	if (
		!isRecord(index) ||
		index.schema !== 1 ||
		!Array.isArray(index.sources) ||
		!Array.isArray(index.spells)
	) {
		throw new Error('Spells index has an invalid schema.');
	}
	const ids = new Set(index.spells.map((spell) => spell.i));
	if (ids.size !== index.spells.length)
		throw new Error('Spells index contains duplicate spell IDs.');
	let count = 0;
	for (const source of index.sources) {
		const bundle = JSON.parse(await readFile(join(outputDirectory, source.f), 'utf8'));
		if (
			bundle.source !== source.s ||
			!Array.isArray(bundle.spells) ||
			bundle.spells.length !== source.c
		) {
			throw new Error(`Spells bundle ${source.s} does not match its index entry.`);
		}
		count += bundle.spells.length;
		for (const spell of bundle.spells) {
			if (!isRecord(spell) || typeof spell.id !== 'string' || !ids.has(spell.id)) {
				throw new Error(`Spells bundle ${source.s} contains an unindexed spell.`);
			}
		}
	}
	if (count !== index.spells.length) throw new Error('Spells bundle and index counts differ.');
	return { sources: index.sources.length, spells: count, diagnostics: index.diagnostics.length };
}

async function main() {
	const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
	const outputDirectory = join(root, 'public', 'compendium', 'spells');
	if (process.argv.includes('--validate')) {
		const report = await validateGeneratedSpells(outputDirectory);
		console.log(
			`Validated ${report.spells} spells in ${report.sources} source bundles (${report.diagnostics} diagnostics).`,
		);
		return;
	}
	const index = await generateSpells({
		rawDirectory: join(root, 'rpg_files', '5etools-2014', 'spells'),
		outputDirectory,
	});
	console.log(
		`Generated ${index.spells.length} spells in ${index.sources.length} source bundles (${index.diagnostics.length} diagnostics).`,
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
	main().catch((error) => {
		console.error(error.stack || error.message);
		process.exitCode = 1;
	});
