import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const HOME_BREW_PATH = resolve('rpg_files/homebrew.json');
const BACKUP_PATH = resolve('rpg_files/dnd-dm-helper-backup-v2.json');
const REPORT_PATH = resolve('rpg_files/homebrew-reconciliation-report.json');

const canonical = (value) =>
	String(value ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('pt-BR')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const unique = (values) => {
	const result = new Map();
	for (const value of values) {
		if (typeof value !== 'string' || !value.trim()) continue;
		const text = value.trim();
		if (!result.has(canonical(text))) result.set(canonical(text), text);
	}
	return [...result.values()];
};

const renderText = (text) =>
	String(text ?? '')
		.replace(/\{@hit\s+([^}]+)}/gi, (_, value) => (value.startsWith('+') ? value : `+${value}`))
		.replace(/\{@dc\s+([^}]+)}/gi, 'DC $1')
		.replace(/\{@h}/gi, 'Hit: ')
		.replace(/\{@atkr?\s+([^}]+)}/gi, '$1 attack')
		.replace(/\{@actsave\s+([^}]+)}/gi, (_, value) => `${String(value).toUpperCase()} Save`)
		.replace(/\{@(?:acttrigger)}/gi, 'Trigger: ')
		.replace(/\{@(?:actresponse)}/gi, 'Response: ')
		.replace(/\{@(?:actsavefail)}/gi, 'Failure: ')
		.replace(/\{@(?:actsavesuccess)}/gi, 'Success: ')
		.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?}/g, '$1')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();

const renderEntries = (entries) =>
	(Array.isArray(entries) ? entries : [])
		.map((entry) => {
			if (typeof entry === 'string') return renderText(entry);
			if (!entry || typeof entry !== 'object') return '';
			const heading = renderText(entry.name ?? '');
			const body = [
				renderText(entry.entry ?? ''),
				renderEntries(entry.entries),
				renderEntries(entry.items),
			]
				.filter(Boolean)
				.join('\n');
			return [heading, body].filter(Boolean).join('\n');
		})
		.filter(Boolean)
		.join('\n');

const spellReference = (value) => {
	const match = String(value ?? '').match(/^\{@spell\s+([^|}]+)(?:\|([^|}]+))?(?:\|[^}]*)?}$/i);
	return match?.[1]?.trim()
		? { name: match[1].trim(), ...(match[2]?.trim() ? { source: match[2].trim() } : {}) }
		: null;
};

const featureKindForSpellcasting = (displayAs) =>
	({ action: 'action', bonus: 'bonus', reaction: 'reaction', trait: 'trait' })[displayAs] ??
	'spellcasting';

const featureId = (monster, kind, index) => `${monster.source}::${monster.name}::${kind}::${index + 1}`;

const featureSections = [
	['trait', 'trait'],
	['action', 'action'],
	['bonus', 'bonus'],
	['reaction', 'reaction'],
	['legendary', 'legendary'],
	['mythic', 'legendary'],
];

const legendaryCost = (name) => {
	const value = String(name ?? '').match(/\(\s*Costs?\s+(\d+)\s+Actions?\s*\)/i)?.[1];
	return value ? { legendaryCost: Number(value) } : {};
};

const abilityRecovery = (name) => {
	const recharge = String(name ?? '').match(/\(\s*Recharge\s+([1-6])(?:\s*[-–]\s*([1-6]))?\s*\)/i);
	if (recharge) {
		const first = Number(recharge[1]);
		const last = Number(recharge[2] ?? recharge[1]);
		return {
			recoveryType: 'dice-recharge',
			rechargeDice: 'd6',
			rechargeOn: Array.from({ length: last - first + 1 }, (_, index) => first + index),
		};
	}
	const perDay = String(name ?? '').match(/\(\s*(\d+)\s*\/\s*Day(?:\s+Each)?\s*\)/i);
	if (perDay) return { recoveryType: 'uses-per-day', maxUses: Number(perDay[1]) };
	const perCombat = String(name ?? '').match(/\(\s*(\d+)\s*\/\s*Combat\s*\)/i);
	return perCombat ? { recoveryType: 'uses-per-combat', maxUses: Number(perCombat[1]) } : null;
};

const defenseEntries = (values, key) =>
	(Array.isArray(values) ? values : []).flatMap((value) => {
		if (typeof value === 'string' && value.trim()) return [{ types: [renderText(value)] }];
		if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
		const record = value;
		const types = unique(Array.isArray(record[key]) ? record[key].map(renderText) : []);
		const note = [record.preNote, record.note, record.special]
			.filter((part) => typeof part === 'string' && part.trim())
			.map(renderText)
			.join(' ');
		return types.length ? [{ types, ...(note ? { note } : {}) }] : [];
	});

const spellData = (monster) => {
	const slotMaximums = new Map();
	const spells = [];
	for (const block of monster.spellcasting ?? []) {
		for (const [levelKey, levelData] of Object.entries(block.spells ?? {})) {
			const level = Number(levelKey);
			if (Number.isInteger(level) && level >= 1 && level <= 9 && Number.isFinite(levelData?.slots)) {
				slotMaximums.set(level, Math.max(slotMaximums.get(level) ?? 0, Math.max(0, levelData.slots)));
			}
			for (const value of levelData?.spells ?? []) {
				const reference = spellReference(value);
				if (!reference) continue;
				spells.push({
					id: `${monster.source}::${monster.name}::spell::${spells.length + 1}`,
					...reference,
					source: reference.source ?? 'PHB',
					level: Number.isInteger(level) ? level : undefined,
					castingGroup: level === 0 ? 'at-will' : 'slot',
				});
			}
		}
		for (const kind of ['will', 'constant']) {
			for (const value of block[kind] ?? []) {
				const reference = spellReference(value);
				if (!reference) continue;
				spells.push({ id: `${monster.source}::${monster.name}::spell::${spells.length + 1}`, ...reference, source: reference.source ?? 'PHB', castingGroup: kind === 'will' ? 'at-will' : 'constant' });
			}
		}
		for (const kind of ['daily', 'rest', 'weekly']) {
			for (const [usesKey, values] of Object.entries(block[kind] ?? {})) {
				const parsed = String(usesKey).match(/^(\d+)(e)?$/i);
				for (const value of values ?? []) {
					const reference = spellReference(value);
					if (!reference) continue;
					spells.push({ id: `${monster.source}::${monster.name}::spell::${spells.length + 1}`, ...reference, source: reference.source ?? 'PHB', castingGroup: kind, ...(parsed ? { uses: Number(parsed[1]) } : {}), ...(parsed?.[2] ? { each: true } : {}) });
				}
			}
		}
	}
	return {
		spellSlots: [...slotMaximums].map(([level, max]) => ({ level, max })).sort((a, b) => a.level - b.level),
		spells,
	};
};

const adaptMonster = (monster, existing) => {
	const { spellSlots, spells } = spellData(monster);
	const features = [];
	for (const [rawKey, kind] of featureSections) {
		for (const [index, block] of (monster[rawKey] ?? []).entries()) {
			if (!block?.name?.trim()) continue;
			features.push({ id: featureId(monster, kind, index), name: block.name.trim(), description: renderEntries(block.entries) || undefined, kind, ...(kind === 'legendary' ? legendaryCost(block.name) : {}) });
		}
	}
	for (const [index, block] of (monster.spellcasting ?? []).entries()) {
		if (!block?.name?.trim()) continue;
		const kind = featureKindForSpellcasting(block.displayAs);
		const description = [renderEntries(block.headerEntries), renderEntries(block.footerEntries)].filter(Boolean).join('\n');
		if (kind !== 'spellcasting' || description) features.push({ id: `${monster.source}::${monster.name}::${kind}::spellcasting-${index + 1}`, name: block.name.trim(), description: description || undefined, kind });
	}
	const specialAbilities = featureSections.flatMap(([rawKey]) =>
		(monster[rawKey] ?? []).flatMap((block, index) => {
			const recovery = abilityRecovery(block?.name);
			return recovery ? [{ id: `${monster.source}::${monster.name}::ability::${rawKey}-${index + 1}`, name: block.name, description: renderEntries(block.entries) || undefined, ...recovery }] : [];
		}),
	);
	const header = (monster.spellcasting ?? []).map((block) => renderEntries(block.headerEntries)).filter(Boolean).join('\n');
	const ability = header.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i)?.[1]?.toLowerCase();
	const abilityMap = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
	const saveDc = header.match(/(?:spell save DC|CD\s*(?:de\s*)?magia)\s*:?\s*(\d+)/i)?.[1];
	const attack = header.match(/(?:\+\s*(\d+)\s*to hit with spell attacks|ataque\s+m[aá]gico\s*:\s*\+?\s*(\d+))/i)?.slice(1).find(Boolean);
	const legendaryIntro = [renderEntries(monster.legendaryHeader), ...(monster.legendary ?? []).map((block) => renderEntries(block.entries)).filter((value) => /legendary actions?/i.test(value))].find(Boolean);
	const count = legendaryIntro?.match(/(\d+)\s+legendary actions?/i)?.[1];
	const scores = Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].flatMap((key) => Number.isFinite(monster[key]) ? [[key, Math.floor(monster[key])]] : []));
	const saves = Object.entries(monster.save ?? {}).flatMap(([abilityKey, bonus]) => /^[+\-]?\d+/.test(String(bonus)) && abilityKey in scores ? [{ ability: abilityKey, bonus: Number(String(bonus).match(/^[+\-]?\d+/)[0]) }] : []);
	const skills = Object.entries(monster.skill ?? {}).flatMap(([name, bonus]) => /^[+\-]?\d+/.test(String(bonus)) ? [{ name, bonus: Number(String(bonus).match(/^[+\-]?\d+/)[0]) }] : []);
	const speed = Object.entries(monster.speed ?? {}).flatMap(([type, value]) => {
		if (type === 'canHover' || value === false) return [];
		if (typeof value === 'number') return [{ type, distance: `${value} ft.`, ...(monster.speed?.canHover && type === 'fly' ? { hover: true } : {}) }];
		if (typeof value === 'string') return [{ type, distance: value }];
		if (value && typeof value === 'object' && typeof value.number === 'number') return [{ type, distance: `${value.number} ft.`, ...(value.hover || monster.speed?.canHover ? { hover: true } : {}) }];
		return [];
	});
	const ac = monster.ac?.[0];
	const armorClass = typeof ac === 'number' ? ac : typeof ac?.ac === 'number' ? ac.ac : null;
	const armorClassNote = typeof ac === 'object' && ac ? [ac.from, ac.condition, ac.note].flat().filter((value) => typeof value === 'string').join(', ') || undefined : undefined;
	const existingTags = [...(existing?.data?.tags ?? []), ...(existing?.tags ?? [])];
	return {
		name: monster.name,
		armorClass,
		maxHp: Number.isFinite(monster.hp?.average) ? Math.floor(monster.hp.average) : 0,
		spellSlots,
		spells,
		specialAbilities,
		features,
		aliases: unique(monster.alias ?? []),
		groups: unique(monster.group ?? []),
		tags: unique([...existingTags, ...(monster.group ?? [])]),
		origin: existing?.data?.origin ?? existing?.origin ?? existing?.source ?? '5eTools',
		source: monster.source,
		size: unique(monster.size ?? []).join(', ') || undefined,
		creatureType: typeof monster.type === 'string' ? monster.type : monster.type?.type,
		alignment: unique(monster.alignment ?? []).join(', ') || undefined,
		challengeRating: monster.cr == null ? undefined : String(monster.cr),
		level: Number.isFinite(monster.level) ? Math.floor(monster.level) : undefined,
		armorClassNote,
		hitPointFormula: monster.hp?.formula?.trim() || undefined,
		speed: speed.length ? speed : undefined,
		abilityScores: Object.keys(scores).length ? scores : undefined,
		savingThrows: saves.length ? saves : undefined,
		skills: skills.length ? skills : undefined,
		passivePerception: Number.isFinite(monster.passive) ? Math.floor(monster.passive) : undefined,
		damageVulnerabilities: defenseEntries(monster.vulnerable, 'vulnerable'),
		damageResistances: defenseEntries(monster.resist, 'resist'),
		damageImmunities: defenseEntries(monster.immune, 'immune'),
		conditionImmunities: unique((monster.conditionImmune ?? []).filter((value) => typeof value === 'string').map(renderText)),
		senses: unique(monster.senses ?? []).map((value) => { const [name, ...detail] = renderText(value).split(/\s+/); return { name, ...(detail.length ? { detail: detail.join(' ') } : {}) }; }),
		languages: unique(monster.languages ?? []),
		spellcasting: header || ability || saveDc || attack ? { ...(abilityMap[ability] ? { ability: abilityMap[ability] } : {}), ...(saveDc ? { spellSaveDc: Number(saveDc) } : {}), ...(attack ? { spellAttackBonus: Number(attack) } : {}), ...(header ? { header } : {}) } : undefined,
		legendaryActions: legendaryIntro || count ? { ...(count ? { count: Number(count) } : {}), ...(legendaryIntro ? { intro: legendaryIntro } : {}) } : undefined,
		fiveEToolsIdentity: { name: monster.name, source: monster.source },
	};
};

const sameMonster = (left, right) => {
	const withoutName = (monster) => {
		const clone = structuredClone(monster);
		delete clone.name;
		return JSON.stringify(clone);
	};
	return withoutName(left) === withoutName(right);
};

const matchSheet = (monster, sheets) => {
	const byIdentity = sheets.filter((sheet) => sheet.data?.fiveEToolsIdentity?.name === monster.name && sheet.data?.fiveEToolsIdentity?.source === monster.source);
	if (byIdentity.length === 1) return { sheet: byIdentity[0], matchedBy: 'identity' };
	const exact = sheets.filter((sheet) => [sheet.data?.name, sheet.title].some((value) => canonical(value) === canonical(monster.name)));
	if (exact.length === 1) return { sheet: exact[0], matchedBy: 'name' };
	const aliases = unique(monster.alias ?? []).map(canonical);
	const composite = sheets.filter((sheet) => {
		const text = canonical(`${sheet.title} ${sheet.data?.name ?? ''}`);
		return text.includes(canonical(monster.name)) && aliases.some((alias) => text.includes(alias));
	});
	return composite.length === 1 ? { sheet: composite[0], matchedBy: 'name-alias' } : null;
};

export function reconcile(homebrew, backup) {
	const sheets = structuredClone(backup.data.homebrewSheets ?? []);
	const report = { migrated: [], imported: [], skipped: [], review: [] };
	const seen = [];
	for (const monster of homebrew.monster ?? []) {
		const duplicate = seen.find((candidate) => candidate.source === monster.source && sameMonster(candidate, monster));
		if (duplicate) {
			report.skipped.push({ name: monster.name, reason: `duplicate of ${duplicate.name}` });
			continue;
		}
		seen.push(monster);
		const match = matchSheet(monster, sheets);
		if (match) {
			const nextData = adaptMonster(monster, match.sheet);
			const next = { ...match.sheet, updatedAt: backup.exportedAt ? Date.parse(backup.exportedAt) : match.sheet.updatedAt, data: nextData, tags: nextData.tags ?? [], source: nextData.origin ?? '' };
			sheets[sheets.findIndex((sheet) => sheet.id === match.sheet.id)] = next;
			report.migrated.push({ name: monster.name, sheetId: next.id, matchedBy: match.matchedBy, fields: Object.keys(nextData).filter((key) => JSON.stringify(nextData[key]) !== JSON.stringify(match.sheet.data?.[key])) });
			continue;
		}
		const id = `5etools-${canonical(`${monster.source}-${monster.name}`).replace(/\s+/g, '-')}`;
		const data = adaptMonster(monster, null);
		sheets.push({ id, externalId: id, title: monster.name, createdAt: Date.parse(backup.exportedAt) || 0, updatedAt: Date.parse(backup.exportedAt) || 0, category: monster.type === 'humanoid' ? 'npc' : 'monster', tags: data.tags ?? [], source: data.origin ?? '', data });
		report.imported.push({ name: monster.name, sheetId: id });
	}
	return { backup: { ...backup, data: { ...backup.data, homebrewSheets: sheets } }, report };
}

async function main() {
	const write = process.argv.includes('--write');
	const [homebrew, backup] = await Promise.all([HOME_BREW_PATH, BACKUP_PATH].map((path) => readFile(path, 'utf8').then(JSON.parse)));
	const result = reconcile(homebrew, backup);
	if (write) {
		await writeFile(BACKUP_PATH, `${JSON.stringify(result.backup, null, 2)}\n`);
		await writeFile(REPORT_PATH, `${JSON.stringify(result.report, null, 2)}\n`);
	}
	console.log(JSON.stringify(result.report, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exitCode = 1; });
