import { readFile } from 'node:fs/promises';

const settlementTypes = new Set(['village', 'city', 'capital', 'other']);
const organizationTypes = new Set(['guild', 'group', 'cult', 'family']);
const scopeTypes = new Set(['global', 'empire', 'state', 'settlement']);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => {
	if (!condition) throw new Error(message);
};
const validateBase = (entity, type) => {
	assert(isRecord(entity), `${type} inválido.`);
	assert(hasText(entity.id) && hasText(entity.name) && hasText(entity.sourcePath), `${type} possui campos obrigatórios inválidos.`);
	assert(Array.isArray(entity.aliases) && entity.aliases.every((alias) => typeof alias === 'string'), `${type} possui aliases inválidos.`);
};
const uniqueIds = (items, type) => {
	const ids = new Set();
	for (const item of items) {
		assert(!ids.has(item.id), `ID duplicado em ${type}: ${item.id}.`);
		ids.add(item.id);
	}
	return ids;
};

try {
	const raw = JSON.parse(await readFile(new URL('../rpg_files/campaign-world.json', import.meta.url), 'utf8'));
	assert(isRecord(raw) && raw.schemaVersion === 1, 'Versão do catálogo da campanha incompatível.');
	assert(['empires', 'states', 'settlements', 'organizations'].every((key) => Array.isArray(raw[key])), 'Catálogo da campanha possui coleções obrigatórias inválidas.');
	raw.empires.forEach((item) => validateBase(item, 'Império'));
	raw.states.forEach((item) => {
		validateBase(item, 'Estado');
		assert(hasText(item.empireId), 'Estado possui império inválido.');
	});
	raw.settlements.forEach((item) => {
		validateBase(item, 'Localidade');
		assert(hasText(item.stateId) && settlementTypes.has(item.settlementType), 'Localidade possui campos geográficos inválidos.');
	});
	raw.organizations.forEach((item) => {
		validateBase(item, 'Organização');
		assert(organizationTypes.has(item.organizationType) && Array.isArray(item.presence), 'Organização possui campos inválidos.');
		if (item.parentOrganizationId !== undefined) assert(hasText(item.parentOrganizationId), 'Organização possui pai inválido.');
		item.presence.forEach((presence) => {
			assert(isRecord(presence) && scopeTypes.has(presence.scopeType) && hasText(presence.presenceType), 'Presença de organização inválida.');
			assert(presence.scopeId === undefined || hasText(presence.scopeId), 'Presença de organização inválida.');
			assert(presence.scopeType === 'global' || hasText(presence.scopeId), 'Presença não-global exige scopeId.');
		});
	});
	const empireIds = uniqueIds(raw.empires, 'impérios');
	const stateIds = uniqueIds(raw.states, 'estados');
	const settlementIds = uniqueIds(raw.settlements, 'localidades');
	const organizationIds = uniqueIds(raw.organizations, 'organizações');
	raw.states.forEach((item) => assert(empireIds.has(item.empireId), `Estado referencia império inexistente: ${item.empireId}.`));
	raw.settlements.forEach((item) => assert(stateIds.has(item.stateId), `Localidade referencia estado inexistente: ${item.stateId}.`));
	raw.organizations.forEach((item) => {
		if (item.parentOrganizationId) assert(organizationIds.has(item.parentOrganizationId), `Organização pai inexistente: ${item.parentOrganizationId}.`);
		item.presence.forEach((presence) => {
			if (presence.scopeType === 'empire') assert(empireIds.has(presence.scopeId), `Presença referencia império inexistente: ${presence.scopeId}.`);
			if (presence.scopeType === 'state') assert(stateIds.has(presence.scopeId), `Presença referencia estado inexistente: ${presence.scopeId}.`);
			if (presence.scopeType === 'settlement') assert(settlementIds.has(presence.scopeId), `Presença referencia localidade inexistente: ${presence.scopeId}.`);
		});
	});
	console.log('campaign-world.json válido.');
} catch (error) {
	console.error(error instanceof Error ? error.message : 'Erro ao validar campaign-world.json.');
	process.exitCode = 1;
}
