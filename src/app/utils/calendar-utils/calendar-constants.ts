import campaignWorld from '../../../../rpg_files/campaign-world.json';
import type { CampaignCalendar } from '../../models/calendar-model';

const CALENDAR = campaignWorld.calendar as CampaignCalendar;

export const DAYS_PER_SEASON = CALENDAR.daysPerSeason;
export const SEASON_ORDER = CALENDAR.seasons.map((season) => season.id);
export const SEASONS = CALENDAR.seasons;
export const EPOCH_DATE = CALENDAR.epochDate;
export const CALENDAR_EVENTS = CALENDAR.events;
