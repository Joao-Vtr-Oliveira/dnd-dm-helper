import { readFile } from 'node:fs/promises';

const settlementTypes = new Set(['village', 'city', 'capital', 'other']);
const organizationTypes = new Set(['guild', 'group']);
const pointOfInterestTypes = new Set([
	'academy',
	'district',
	'government',
	'inn',
	'landmark',
	'market',
	'natural',
	'organization',
	'other',
	'port',
	'residence',
	'shop',
	'tavern',
	'temple',
	'workshop',
]);
const scopeTypes = new Set(['global', 'empire', 'state', 'settlement']);
const seasonIds = new Set(['spring', 'summer', 'autumn', 'winter']);
const deityIds = new Set(['luuren', 'atronos', 'dreyc', 'ruuz', 'vozc', 'luna', 'pulacc', 'geraldo', 'achos']);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => {
	if (!condition) throw new Error(message);
};
const validateBase = (entity, type) => {
	assert(isRecord(entity), `${type} inválido.`);
	assert(
		hasText(entity.id) && hasText(entity.name) && hasText(entity.sourcePath),
		`${type} possui campos obrigatórios inválidos.`,
	);
	assert(
		Array.isArray(entity.aliases) && entity.aliases.every((alias) => typeof alias === 'string'),
		`${type} possui aliases inválidos.`,
	);
};
const uniqueIds = (items, type) => {
	const ids = new Set();
	for (const item of items) {
		assert(!ids.has(item.id), `ID duplicado em ${type}: ${item.id}.`);
		ids.add(item.id);
	}
	return ids;
};
const integerInRange = (value, min, max) =>
	typeof value === 'number' && Number.isInteger(value) && value >= min && (max === undefined || value <= max);
const validateCalendar = (calendar) => {
	assert(isRecord(calendar), 'Calendário da campanha inválido.');
	assert(integerInRange(calendar.daysPerSeason, 1), 'Calendário possui duração de estação inválida.');
	assert(
		Array.isArray(calendar.seasons) && calendar.seasons.length === seasonIds.size,
		'Calendário possui estações inválidas.',
	);
	const configuredSeasons = new Set();
	calendar.seasons.forEach((season) => {
		assert(
			isRecord(season) &&
			seasonIds.has(season.id) &&
			hasText(season.label) &&
			hasText(season.color) &&
			!configuredSeasons.has(season.id),
			'Calendário possui estação inválida.',
		);
		configuredSeasons.add(season.id);
	});
	assert(configuredSeasons.size === seasonIds.size, 'Calendário possui estações incompletas.');
	assert(isRecord(calendar.epochDate), 'Calendário possui data-base inválida.');
	assert(
		integerInRange(calendar.epochDate.year, 0) &&
		seasonIds.has(calendar.epochDate.season) &&
		integerInRange(calendar.epochDate.day, 1, calendar.daysPerSeason) &&
		integerInRange(calendar.epochDate.hour, 0, 23) &&
		integerInRange(calendar.epochDate.minute, 0, 59),
		'Calendário possui data-base inválida.',
	);
	assert(Array.isArray(calendar.events), 'Calendário possui eventos inválidos.');
	const eventIds = new Set();
	calendar.events.forEach((event) => {
		assert(
			isRecord(event) &&
			hasText(event.id) &&
			!eventIds.has(event.id) &&
			seasonIds.has(event.season) &&
			integerInRange(event.day, 1, calendar.daysPerSeason) &&
			hasText(event.title) &&
			hasText(event.description) &&
			(event.deity === undefined || deityIds.has(event.deity)) &&
			(event.tags === undefined || (Array.isArray(event.tags) && event.tags.every((tag) => typeof tag === 'string'))),
			'Calendário possui evento inválido.',
		);
		eventIds.add(event.id);
	});
};

try {
	const raw = JSON.parse(
		await readFile(new URL('../rpg_files/campaign-world.json', import.meta.url), 'utf8'),
	);
	assert(isRecord(raw) && raw.schemaVersion === 1, 'Versão do catálogo da campanha incompatível.');
	assert(
		isRecord(raw.calendar) &&
		['empires', 'states', 'settlements', 'organizations', 'pointsOfInterest'].every((key) =>
			Array.isArray(raw[key]),
		),
		'Catálogo da campanha possui coleções obrigatórias inválidas.',
	);
	validateCalendar(raw.calendar);
	raw.empires.forEach((item) => validateBase(item, 'Império'));
	raw.states.forEach((item) => {
		validateBase(item, 'Estado');
		assert(hasText(item.empireId), 'Estado possui império inválido.');
	});
	raw.settlements.forEach((item) => {
		validateBase(item, 'Localidade');
		assert(
			hasText(item.stateId) && settlementTypes.has(item.settlementType),
			'Localidade possui campos geográficos inválidos.',
		);
	});
	raw.organizations.forEach((item) => {
		validateBase(item, 'Organização');
		assert(
			organizationTypes.has(item.organizationType) && Array.isArray(item.presence),
			'Organização possui campos inválidos.',
		);
		if (item.parentOrganizationId !== undefined)
			assert(hasText(item.parentOrganizationId), 'Organização possui pai inválido.');
		item.presence.forEach((presence) => {
			assert(
				isRecord(presence) && scopeTypes.has(presence.scopeType) && hasText(presence.presenceType),
				'Presença de organização inválida.',
			);
			assert(
				presence.scopeId === undefined || hasText(presence.scopeId),
				'Presença de organização inválida.',
			);
			assert(
				presence.scopeType === 'global' || hasText(presence.scopeId),
				'Presença não-global exige scopeId.',
			);
		});
	});
	raw.pointsOfInterest.forEach((item) => {
		validateBase(item, 'Ponto de interesse');
		assert(
			hasText(item.settlementId) && pointOfInterestTypes.has(item.poiType),
			'Ponto de interesse possui campos inválidos.',
		);
		assert(
			item.summary === undefined || hasText(item.summary),
			'Ponto de interesse possui resumo inválido.',
		);
		assert(
			item.organizationIds === undefined ||
				(Array.isArray(item.organizationIds) &&
					item.organizationIds.every((id) => typeof id === 'string')),
			'Ponto de interesse possui organizações inválidas.',
		);
	});
	const empireIds = uniqueIds(raw.empires, 'impérios');
	const stateIds = uniqueIds(raw.states, 'estados');
	const settlementIds = uniqueIds(raw.settlements, 'localidades');
	const organizationIds = uniqueIds(raw.organizations, 'organizações');
	uniqueIds(raw.pointsOfInterest, 'pontos de interesse');
	raw.states.forEach((item) =>
		assert(
			empireIds.has(item.empireId),
			`Estado referencia império inexistente: ${item.empireId}.`,
		),
	);
	raw.settlements.forEach((item) =>
		assert(
			stateIds.has(item.stateId),
			`Localidade referencia estado inexistente: ${item.stateId}.`,
		),
	);
	raw.organizations.forEach((item) => {
		if (item.parentOrganizationId)
			assert(
				organizationIds.has(item.parentOrganizationId),
				`Organização pai inexistente: ${item.parentOrganizationId}.`,
			);
		item.presence.forEach((presence) => {
			if (presence.scopeType === 'empire')
				assert(
					empireIds.has(presence.scopeId),
					`Presença referencia império inexistente: ${presence.scopeId}.`,
				);
			if (presence.scopeType === 'state')
				assert(
					stateIds.has(presence.scopeId),
					`Presença referencia estado inexistente: ${presence.scopeId}.`,
				);
			if (presence.scopeType === 'settlement')
				assert(
					settlementIds.has(presence.scopeId),
					`Presença referencia localidade inexistente: ${presence.scopeId}.`,
				);
		});
	});
	raw.pointsOfInterest.forEach((item) => {
		assert(
			settlementIds.has(item.settlementId),
			`Ponto de interesse referencia localidade inexistente: ${item.settlementId}.`,
		);
		(item.organizationIds ?? []).forEach((organizationId) =>
			assert(
				organizationIds.has(organizationId),
				`Ponto de interesse referencia organização inexistente: ${organizationId}.`,
			),
		);
	});
	console.log('campaign-world.json válido.');
} catch (error) {
	console.error(error instanceof Error ? error.message : 'Erro ao validar campaign-world.json.');
	process.exitCode = 1;
}
