import { Injectable, inject } from '@angular/core';
import type { CompendiumFeature, CompendiumMonster } from '../../models/compendium-bestiary-model';
import type {
	CreatureAbilityKey,
	CreatureDamageDefense,
	CreatureFeature,
	CreatureSheet,
	CreatureSpecialAbility,
} from '../../models/creature-sheet-model';
import { CompendiumRendererService } from '../compendium-renderer-service/compendium-renderer-service';

@Injectable({ providedIn: 'root' })
export class CompendiumCreatureAdapterService {
	private readonly renderer = inject(CompendiumRendererService);

	toCreatureSheet(monster: CompendiumMonster): CreatureSheet {
		const spellData = this.spellData(monster);
		const features = this.features(monster);
		return {
			name: monster.name,
			armorClass: monster.armorClass,
			maxHp: monster.hitPoints,
			spellSlots: spellData.spellSlots,
			spells: spellData.spells,
			specialAbilities: this.specialAbilities(monster),
			features,
			aliases: monster.aliases.length ? structuredClone(monster.aliases) : undefined,
			tags: this.tags(monster.tags),
			source: monster.source,
			size: monster.sizes.join(', ') || undefined,
			creatureType: [monster.type, ...monster.subtypes].filter(Boolean).join(' ') || undefined,
			alignment: this.alignment(monster.alignment),
			challengeRating: monster.challengeRating,
			level: monster.level,
			armorClassNote: this.armorClassNote(monster),
			hitPointFormula: monster.hitPointFormula,
			speed: this.speed(monster.speed),
			abilityScores: this.abilityScores(monster.abilities),
			savingThrows: this.savingThrows(monster.saves),
			skills: this.skills(monster.skills),
			passivePerception: monster.passive,
			damageVulnerabilities: this.defenses(monster.vulnerable),
			damageResistances: this.defenses(monster.resist),
			damageImmunities: this.defenses(monster.immune),
			conditionImmunities: this.values(monster.conditionImmune),
			senses: this.senses(monster.senses),
			languages: monster.languages.length ? structuredClone(monster.languages) : undefined,
			spellcasting: this.spellcastingMetadata(monster),
			legendaryActions: this.legendaryMetadata(monster),
			fiveEToolsIdentity: { name: monster.name, source: monster.source },
			officialOrigin: { provider: '5etools', name: monster.name, source: monster.source },
			officialSnapshot: structuredClone(monster),
		};
	}

	private features(monster: CompendiumMonster): CreatureFeature[] {
		const features: CreatureFeature[] = [];
		const add = (section: CompendiumFeature[], kind: CreatureFeature['kind']) => {
			for (const [index, feature] of section.entries()) {
				features.push({
					id: `${monster.id}::${kind}::${index + 1}`,
					name: feature.name,
					description: this.renderer.renderEntries(feature.entries) || undefined,
					kind,
					...(kind === 'legendary' ? this.legendaryCost(feature.name) : {}),
				});
			}
		};
		add(monster.traits, 'trait');
		add(monster.actions, 'action');
		add(monster.bonusActions, 'bonus');
		add(monster.reactions, 'reaction');
		add(monster.legendaryActions, 'legendary');
		add(monster.mythicActions, 'legendary');
		for (const [index, block] of monster.spellcasting.entries()) {
			const kind = this.spellcastingKind(block.displayAs);
			features.push({
				id: `${monster.id}::${kind}::spellcasting-${index + 1}`,
				name: block.name,
				description:
					[
						this.renderer.renderEntries(block.headerEntries),
						this.describeSpellLevels(block.spells, block.spellLists),
						this.renderer.renderEntries(block.footerEntries),
					]
						.filter(Boolean)
						.join('\n') || undefined,
				kind,
			});
		}
		return features;
	}

	private specialAbilities(monster: CompendiumMonster): CreatureSpecialAbility[] {
		const sections = [
			...monster.traits,
			...monster.actions,
			...monster.bonusActions,
			...monster.reactions,
			...monster.legendaryActions,
			...monster.mythicActions,
		];
		return sections.flatMap((feature, index) => {
			const recharge = feature.name.match(
				/\(\s*Recharge\s+([1-6])(?:\s*[-\u2013]\s*([1-6]))?\s*\)/i,
			);
			const perDay = feature.name.match(/\(\s*(\d+)\s*\/\s*Day(?:\s+Each)?\s*\)/i);
			const perCombat = feature.name.match(/\(\s*(\d+)\s*\/\s*Combat\s*\)/i);
			const rechargeStart = Number(recharge?.[1]);
			const rechargeEnd = Number(recharge?.[2] ?? recharge?.[1]);
			const validRecharge = !!recharge && rechargeStart <= rechargeEnd;
			if (!validRecharge && !perDay && !perCombat) return [];
			return [
				{
					id: `${monster.id}::ability::${index + 1}`,
					name: feature.name,
					description: this.renderer.renderEntries(feature.entries) || undefined,
					...(validRecharge
						? {
								recoveryType: 'dice-recharge' as const,
								rechargeDice: 'd6' as const,
								rechargeOn: Array.from(
									{ length: rechargeEnd - rechargeStart + 1 },
									(_, offset) => rechargeStart + offset,
								),
							}
						: perCombat
							? {
									recoveryType: 'uses-per-combat' as const,
									maxUses: Number(perCombat[1]),
								}
							: {
								recoveryType: 'uses-per-day' as const,
								maxUses: Number(perDay?.[1]),
							}),
				},
			];
		});
	}

	private spellData(monster: CompendiumMonster): Pick<CreatureSheet, 'spellSlots' | 'spells'> {
		const slotMaximums = new Map<number, number>();
		const spells: CreatureSheet['spells'] = [];
		for (const block of monster.spellcasting) {
			for (const [levelKey, levelData] of Object.entries(block.spells)) {
				const level = Number(levelKey);
				if (
					Number.isInteger(level) &&
					level >= 1 &&
					level <= 9 &&
					Number.isFinite(levelData.slots)
				) {
					slotMaximums.set(
						level,
						Math.max(slotMaximums.get(level) ?? 0, Math.max(0, Math.floor(levelData.slots ?? 0))),
					);
				}
				for (const rawSpell of levelData.spells ?? []) {
					const reference = this.renderer.spellReference(rawSpell);
					if (!reference) continue;
					spells.push({
						id: `${monster.id}::spell::${spells.length + 1}`,
						name: reference.name,
						// 5etools 2014 spell tags without a source use the PHB by default.
						source: reference.source ?? 'PHB',
						level: Number.isInteger(level) ? level : undefined,
						...(level === 0
							? { castingGroup: 'at-will' as const }
							: { castingGroup: 'slot' as const }),
					});
				}
			}
			for (const [listKey, rawSpells] of Object.entries(block.spellLists)) {
				const list = listKey.match(/^(will|constant|daily|rest|weekly)(?::(\d+)(e)?)?/i);
				for (const rawSpell of rawSpells) {
					const reference = this.renderer.spellReference(rawSpell);
					if (!reference) continue;
					spells.push({
						id: `${monster.id}::spell::${spells.length + 1}`,
						name: reference.name,
						source: reference.source ?? 'PHB',
						...(list?.[1] === 'will' ? { castingGroup: 'at-will' as const } : {}),
						...(list?.[1] === 'constant' ? { castingGroup: 'constant' as const } : {}),
						...(['daily', 'rest', 'weekly'].includes(list?.[1] ?? '')
							? { castingGroup: list![1] as 'daily' | 'rest' | 'weekly' }
							: {}),
						...(list?.[2] ? { uses: Number(list[2]) } : {}),
						...(list?.[3] === 'e' ? { each: true } : {}),
					});
				}
			}
		}
		return {
			spellSlots: [...slotMaximums.entries()]
				.map(([level, max]) => ({ level, max }))
				.sort((left, right) => left.level - right.level),
			spells,
		};
	}

	private describeSpellLevels(
		spells: Record<string, { spells?: string[] }>,
		spellLists: Record<string, string[]>,
	): string {
		return [
			...Object.entries(spells)
				.map(
					([level, data]) =>
						`${level}: ${(data.spells ?? []).map((spell) => this.renderer.renderText(spell)).join(', ')}`,
				)
				.filter((line) => !line.endsWith(': ')),
			...Object.entries(spellLists).map(
				([list, values]) =>
					`${list}: ${values.map((spell) => this.renderer.renderText(spell)).join(', ')}`,
			),
		].join('\n');
	}

	private alignment(values: unknown[]): string | undefined {
		const alignment = values
			.map((value) => (typeof value === 'string' ? value : this.renderer.renderText(String(value))))
			.filter(Boolean)
			.join(', ');
		return alignment || undefined;
	}

	private armorClassNote(monster: CompendiumMonster): string | undefined {
		const value = monster.raw.ac?.[0];
		if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
		const record = value as Record<string, unknown>;
		const parts = [record['from'], record['condition'], record['note']]
			.flatMap((part) => (Array.isArray(part) ? part : [part]))
			.filter((part): part is string => typeof part === 'string' && !!part.trim());
		return parts.length ? parts.join(', ') : undefined;
	}

	private speed(speed: Record<string, unknown>): CreatureSheet['speed'] {
		const values = Object.entries(speed).flatMap(([type, value]) => {
			if (type === 'canHover' || value === false) return [];
			if (typeof value === 'number') return [{ type, distance: `${value} ft.` }];
			if (typeof value === 'string') return [{ type, distance: value }];
			if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
			const record = value as Record<string, unknown>;
			const distance =
				typeof record['number'] === 'number' ? `${record['number']} ft.` : record['number'];
			return [
				{
					type,
					...(typeof distance === 'string' && distance.trim() ? { distance: distance.trim() } : {}),
					...(record['hover'] === true || speed['canHover'] === true ? { hover: true } : {}),
				},
			];
		});
		return values.length ? values : undefined;
	}

	private abilityScores(abilities: CompendiumMonster['abilities']): CreatureSheet['abilityScores'] {
		const scores = Object.fromEntries(
			(Object.entries(abilities) as Array<[CreatureAbilityKey, number | undefined]>).flatMap(
				([ability, value]) => (Number.isFinite(value) ? [[ability, Math.floor(value!)]] : []),
			),
		) as Partial<Record<CreatureAbilityKey, number>>;
		return Object.keys(scores).length ? scores : undefined;
	}

	private savingThrows(saves: Record<string, string>): CreatureSheet['savingThrows'] {
		const values = Object.entries(saves).flatMap(([ability, bonus]) => {
			if (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(ability.toLocaleLowerCase()))
				return [];
			const parsed = this.bonus(bonus);
			return parsed === undefined
				? []
				: [{ ability: ability.toLocaleLowerCase() as CreatureAbilityKey, bonus: parsed }];
		});
		return values.length ? values : undefined;
	}

	private skills(skills: Record<string, string>): CreatureSheet['skills'] {
		const values = Object.entries(skills).flatMap(([name, bonus]) => {
			const parsed = this.bonus(bonus);
			return parsed === undefined ? [] : [{ name, bonus: parsed }];
		});
		return values.length ? values : undefined;
	}

	private defenses(values: unknown[]): CreatureDamageDefense[] | undefined {
		const normalized = values.flatMap((value) => {
			if (typeof value === 'string' && value.trim())
				return [{ types: [this.renderer.renderText(value)] }];
			if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
			const record = value as Record<string, unknown>;
			const types = Array.isArray(record['resist'])
				? record['resist']
				: Array.isArray(record['immune'])
					? record['immune']
					: Array.isArray(record['vulnerable'])
						? record['vulnerable']
						: [];
			const textTypes = types
				.filter((type): type is string => typeof type === 'string' && !!type.trim())
				.map((type) => this.renderer.renderText(type));
			const note = [record['preNote'], record['note'], record['special']]
				.filter((part): part is string => typeof part === 'string' && !!part.trim())
				.join(' ');
			return textTypes.length ? [{ types: textTypes, ...(note ? { note } : {}) }] : [];
		});
		return normalized.length ? normalized : undefined;
	}

	private values(values: unknown[]): string[] | undefined {
		const normalized = values
			.map((value) => (typeof value === 'string' ? this.renderer.renderText(value) : ''))
			.filter(Boolean);
		return normalized.length ? normalized : undefined;
	}

	private senses(values: string[]): CreatureSheet['senses'] {
		const normalized = values.flatMap((value) => {
			const [name, ...detail] = this.renderer.renderText(value).split(/\s+/);
			return name ? [{ name, ...(detail.length ? { detail: detail.join(' ') } : {}) }] : [];
		});
		return normalized.length ? normalized : undefined;
	}

	private spellcastingMetadata(monster: CompendiumMonster): CreatureSheet['spellcasting'] {
		const header = monster.spellcasting
			.map((block) => this.renderer.renderEntries(block.headerEntries))
			.filter(Boolean)
			.join('\n');
		const text = header || '';
		const ability = text.match(
			/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i,
		)?.[1];
		const abilityMap: Record<string, CreatureAbilityKey> = {
			strength: 'str',
			dexterity: 'dex',
			constitution: 'con',
			intelligence: 'int',
			wisdom: 'wis',
			charisma: 'cha',
		};
		const saveDc = text.match(/(?:spell save DC|CD\s*(?:de\s*)?magia)\s*:?\s*(\d+)/i)?.[1];
		const attack = text.match(
			/(?:\+\s*(\d+)\s*to hit with spell attacks|ataque\s+m[aá]gico\s*:\s*\+?\s*(\d+))/i,
		)?.slice(1).find(Boolean);
		const normalized = {
			...(ability && abilityMap[ability.toLocaleLowerCase()]
				? { ability: abilityMap[ability.toLocaleLowerCase()] }
				: {}),
			...(saveDc ? { spellSaveDc: Number(saveDc) } : {}),
			...(attack ? { spellAttackBonus: Number(attack) } : {}),
			...(header ? { header } : {}),
		};
		return Object.keys(normalized).length ? normalized : undefined;
	}

	private legendaryMetadata(monster: CompendiumMonster): CreatureSheet['legendaryActions'] {
		const intro = [
			this.renderer.renderEntries(monster.legendaryHeader ?? []),
			...monster.legendaryActions
			.map((feature) => this.renderer.renderEntries(feature.entries))
				.filter((text) => /legendary actions?/i.test(text)),
		].find(Boolean);
		const count = intro?.match(/(\d+)\s+legendary actions?/i)?.[1];
		return intro || count
			? { ...(count ? { count: Number(count) } : {}), ...(intro ? { intro } : {}) }
			: undefined;
	}

	private bonus(value: string): number | undefined {
		const match = value.trim().match(/^[+\-]?\d+/);
		return match ? Number(match[0]) : undefined;
	}

	private spellcastingKind(displayAs: string | undefined): CreatureFeature['kind'] {
		if (displayAs === 'action') return 'action';
		if (displayAs === 'bonus') return 'bonus';
		if (displayAs === 'reaction') return 'reaction';
		if (displayAs === 'trait') return 'trait';
		return 'spellcasting';
	}

	private tags(tags: CompendiumMonster['tags']): string[] | undefined {
		const values = [...(tags['traitTags'] ?? []), ...(tags['actionTags'] ?? [])];
		return values.length ? [...new Set(values)] : undefined;
	}

	private legendaryCost(name: string): Pick<CreatureFeature, 'legendaryCost'> {
		const cost = name.match(/\(\s*Costs?\s+(\d+)\s+Actions?\s*\)/i)?.[1];
		return cost ? { legendaryCost: Number(cost) } : {};
	}
}
