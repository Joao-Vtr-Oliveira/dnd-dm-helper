import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATASETS = {
	skills: { file: 'skills.json', property: 'skill' },
	languages: { file: 'languages.json', property: 'language' },
	senses: { file: 'senses.json', property: 'sense' },
	conditions: { file: 'conditionsdiseases.json', property: 'condition' },
	monsterFeatures: { file: 'monsterfeatures.json', property: 'monsterfeatures' },
	feats: { file: 'feats.json', property: 'feat' },
};

const STRING_CATEGORIES = ['skills', 'languages', 'senses', 'conditions'];

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

function names(entries, category) {
	if (!Array.isArray(entries)) throw new Error(`${category} dataset must be an array.`);
	const unique = new Map();
	for (const entry of entries) {
		if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name.trim()) continue;
		const name = entry.name.trim();
		if (!unique.has(name.toLocaleLowerCase())) unique.set(name.toLocaleLowerCase(), name);
	}
	return [...unique.values()].sort((left, right) => left.localeCompare(right));
}

function requiredString(entry, property, category) {
	if (typeof entry[property] !== 'string' || !entry[property].trim()) {
		throw new Error(`${category} entries must have a ${property}.`);
	}
	return entry[property].trim();
}

function monsterFeatures(entries) {
	if (!Array.isArray(entries)) throw new Error('monsterFeatures dataset must be an array.');
	return entries
		.map((entry) => {
			if (!isRecord(entry)) throw new Error('monsterFeatures entries must be objects.');
			if (entry.hasNumberParam !== undefined && typeof entry.hasNumberParam !== 'boolean') {
				throw new Error('monsterFeatures hasNumberParam must be a boolean.');
			}
			return {
				name: requiredString(entry, 'name', 'monsterFeatures'),
				effect: requiredString(entry, 'effect', 'monsterFeatures'),
				example: requiredString(entry, 'example', 'monsterFeatures'),
				...(entry.hasNumberParam !== undefined ? { hasNumberParam: entry.hasNumberParam } : {}),
			};
		})
		.sort((left, right) => left.name.localeCompare(right.name));
}

function validateStructuredOrder(entries, category, key) {
	const keys = entries.map(key);
	if (new Set(keys.map((value) => value.toLocaleLowerCase())).size !== entries.length) {
		throw new Error(`Suggestions catalog contains duplicate ${category}.`);
	}
	if (keys.some((value, index) => index > 0 && keys[index - 1].localeCompare(value) > 0)) {
		throw new Error(`Suggestions catalog has unsorted ${category}.`);
	}
}

function feats(entries) {
	if (!Array.isArray(entries)) throw new Error('feats dataset must be an array.');
	return entries
		.map((entry) => {
			if (!isRecord(entry)) throw new Error('feats entries must be objects.');
			if (!Array.isArray(entry.entries)) throw new Error('feats entries must have entries.');
			if (entry.page !== undefined && (!Number.isFinite(entry.page) || entry.page < 0)) {
				throw new Error('feats page must be a non-negative number.');
			}
			return {
				name: requiredString(entry, 'name', 'feats'),
				source: requiredString(entry, 'source', 'feats'),
				...(entry.page !== undefined ? { page: entry.page } : {}),
				entries: entry.entries,
			};
		})
		.sort((left, right) => left.name.localeCompare(right.name) || left.source.localeCompare(right.source));
}

export function compileCompendiumSuggestions(rawDatasets) {
	return {
		schema: 2,
		skills: names(rawDatasets.skills, 'skills'),
		languages: names(rawDatasets.languages, 'languages'),
		senses: names(rawDatasets.senses, 'senses'),
		conditions: names(rawDatasets.conditions, 'conditions'),
		monsterFeatures: monsterFeatures(rawDatasets.monsterFeatures),
		feats: feats(rawDatasets.feats),
	};
}

export async function readRawCompendiumSuggestions(rawDirectory) {
	const result = {};
	for (const [category, dataset] of Object.entries(DATASETS)) {
		let data;
		try {
			data = JSON.parse(await readFile(join(rawDirectory, dataset.file), 'utf8'));
		} catch (error) {
			throw new Error(`Unable to read ${dataset.file}: ${error.message}`);
		}
		if (!isRecord(data)) throw new Error(`${dataset.file} must be an object.`);
		result[category] = data[dataset.property];
	}
	return result;
}

export async function generateCompendiumSuggestions({ rawDirectory, outputFile }) {
	const catalog = compileCompendiumSuggestions(await readRawCompendiumSuggestions(rawDirectory));
	const temporaryFile = `${outputFile}.tmp`;
	await rm(temporaryFile, { force: true });
	await mkdir(dirname(outputFile), { recursive: true });
	await writeFile(temporaryFile, JSON.stringify(catalog));
	await rename(temporaryFile, outputFile);
	return catalog;
}

export async function validateCompendiumSuggestions(outputFile) {
	const catalog = JSON.parse(await readFile(outputFile, 'utf8'));
	if (!isRecord(catalog) || catalog.schema !== 2) throw new Error('Suggestions catalog has an invalid schema.');
	for (const category of STRING_CATEGORIES) {
		const suggestions = catalog[category];
		if (!Array.isArray(suggestions) || suggestions.some((item) => typeof item !== 'string' || !item.trim())) {
			throw new Error(`Suggestions catalog has invalid ${category}.`);
		}
		const normalized = suggestions.map((item) => item.toLocaleLowerCase());
		if (new Set(normalized).size !== suggestions.length) {
			throw new Error(`Suggestions catalog contains duplicate ${category}.`);
		}
		if (suggestions.some((item, index) => index > 0 && suggestions[index - 1].localeCompare(item) > 0)) {
			throw new Error(`Suggestions catalog has unsorted ${category}.`);
		}
	}
	monsterFeatures(catalog.monsterFeatures);
	feats(catalog.feats);
	validateStructuredOrder(catalog.monsterFeatures, 'monsterFeatures', (feature) => feature.name);
	validateStructuredOrder(catalog.feats, 'feats', (feat) => `${feat.name}\u0000${feat.source}`);
	return Object.fromEntries(Object.keys(DATASETS).map((category) => [category, catalog[category].length]));
}

async function main() {
	const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
	const outputFile = join(root, 'public', 'compendium', 'suggestions.json');
	if (process.argv.includes('--validate')) {
		const report = await validateCompendiumSuggestions(outputFile);
		console.log(`Validated ${Object.values(report).reduce((total, count) => total + count, 0)} suggestions.`);
		return;
	}
	const catalog = await generateCompendiumSuggestions({
		rawDirectory: join(root, 'rpg_files', '5etools-2014'),
		outputFile,
	});
	console.log(`Generated ${Object.values(catalog).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)} suggestions.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
	main().catch((error) => {
		console.error(error.stack || error.message);
		process.exitCode = 1;
	});
