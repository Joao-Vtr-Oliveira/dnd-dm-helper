import { Injectable, inject } from '@angular/core';
import type { CompendiumFeature, CompendiumMonster } from '../../models/compendium-bestiary-model';
import type {
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
		return {
			name: monster.name,
			armorClass: monster.armorClass,
			maxHp: monster.hitPoints,
			spellSlots: spellData.spellSlots,
			spells: spellData.spells,
			specialAbilities: this.specialAbilities(monster),
			features: this.features(monster),
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
			features.push({
				id: `${monster.id}::spellcasting::${index + 1}`,
				name: block.name,
				description:
					[
						this.renderer.renderEntries(block.headerEntries),
						this.describeSpellLevels(block.spells, block.spellLists),
						this.renderer.renderEntries(block.footerEntries),
					]
						.filter(Boolean)
						.join('\n') || undefined,
				kind: 'spellcasting',
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
			const rechargeStart = Number(recharge?.[1]);
			const rechargeEnd = Number(recharge?.[2] ?? recharge?.[1]);
			const validRecharge = !!recharge && rechargeStart <= rechargeEnd;
			if (!validRecharge && !perDay) return [];
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
					});
				}
			}
			for (const [listKey, rawSpells] of Object.entries(block.spellLists)) {
				const uses = listKey.match(/^(?:daily|rest|weekly):(\d+)/i);
				for (const rawSpell of rawSpells) {
					const reference = this.renderer.spellReference(rawSpell);
					if (!reference) continue;
					spells.push({
						id: `${monster.id}::spell::${spells.length + 1}`,
						name: reference.name,
						source: reference.source ?? 'PHB',
						...(uses ? { uses: Number(uses[1]) } : {}),
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
}
