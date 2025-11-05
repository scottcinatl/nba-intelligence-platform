/**
 * Constants and Configuration
 * All magic numbers, thresholds, and weights in one place
 */

export const ENHANCEMENT_WEIGHTS = {
  MAX_MULTIPLIER: 1.20, // Maximum 20% total boost
  PACE_ADVANTAGE_THRESHOLD: 3, // Pace differential to trigger boost
  THREE_POINT_RATE_THRESHOLD: 0.40,
  THREE_POINT_DEFENSE_THRESHOLD: 0.37,
  BALL_MOVEMENT_THRESHOLD: 0.60,
  PAINT_FREQUENCY_THRESHOLD: 0.35,
  PAINT_DEFENSE_THRESHOLD: 42,
  TRANSITION_FREQUENCY_THRESHOLD: 0.18,
  TRANSITION_DEFENSE_THRESHOLD: 0.50
};

export const IMPACT_SCORE_THRESHOLDS = {
  SUPERSTAR: 40,
  STAR: 25,
  KEY_ROLE: 15
};

export const IMPACT_SCORE_WEIGHTS = {
  POINTS: 1.0,
  ASSISTS: 1.5,
  REBOUNDS: 1.2,
  STEALS: 2.0,
  BLOCKS: 2.0
};

export const INJURY_STATUS_IMPACTS = {
  out: { playProbability: 0.0, effectiveness: 0.0, description: 'Will not play' },
  doubtful: { playProbability: 0.20, effectiveness: 0.60, description: '20% plays, limited if active' },
  questionable: { playProbability: 0.65, effectiveness: 0.75, description: '65% plays, may be limited' },
  probable: { playProbability: 0.90, effectiveness: 0.95, description: '90% plays, near full effectiveness' }
};

export const INJURY_BOOST_MULTIPLIERS = {
  SUPERSTAR_OUT: 0.20,
  STAR_OUT: 0.15,
  KEY_ROLE_OUT: 0.08,
  SUPERSTAR_RETURN: -0.08,
  STAR_RETURN: -0.05,
  KEY_ROLE_RETURN: -0.03
};

export const GAME_SCRIPT_THRESHOLDS = {
  PAINT_DIFFERENTIAL_MEDIUM: 5.0,
  PAINT_DIFFERENTIAL_HIGH: 8.0,
  PACE_DIFFERENTIAL_MEDIUM: 4.0,
  PACE_DIFFERENTIAL_HIGH: 6.0,
  THREE_POINT_DIFFERENTIAL_MEDIUM: 0.04,
  THREE_POINT_DIFFERENTIAL_HIGH: 0.06
};

export const GAME_SCRIPT_ADJUSTMENTS = {
  INTERIOR_HIGH: 3.0,
  INTERIOR_MEDIUM: 1.5,
  PERIMETER_HIGH: 2.5,
  PERIMETER_MEDIUM: 1.2,
  TEMPO_HIGH: 2.0,
  TEMPO_MEDIUM: 1.0
};

export const POSSESSION_MODEL = {
  TURNOVER_WEIGHT: 0.4, // Each extra turnover = 0.4 possession swing
  OREB_WEIGHT: 0.35, // Offensive rebound impact
  DEFENSIVE_EXPONENT: 0.7, // Non-linear defense (research-backed)
  NBA_AVERAGE_PPP: 1.10, // NBA average points per possession
  PACE_BOUNDS: { MIN: 85, MAX: 115 }
};

export const SCHEDULE_ADJUSTMENTS = {
  BACK_TO_BACK_POSSESSIONS: -1.5,
  BACK_TO_BACK_EFFICIENCY: 0.97, // -3%
  REST_POSSESSIONS_PER_DAY: 0.3,
  REST_EFFICIENCY_PER_DAY: 0.005, // +0.5% per day
  MAX_REST_EFFICIENCY_BOOST: 0.02 // Cap at +2%
};

export const OPPONENT_DEFENSE = {
  ELITE_RIM_PROTECTOR_BPG: 5.0,
  ZONE_DEFENSE_3P_THRESHOLD: 0.375,
  ELITE_PERIMETER_3P_THRESHOLD: 0.345,
  SWITCH_HEAVY_DEF_RATING: 108,
  SWITCH_HEAVY_OPP_ASSISTS: 23,
  WEAK_PAINT_DEFENSE: 50,

  // Adjustment multipliers
  RIM_PROTECTOR_VS_DRIVER: 0.93, // -7%
  RIM_PROTECTOR_FTA_BOOST: 1.15, // +15%
  ZONE_VS_SHOOTER: 1.05, // +5%
  ZONE_3PA_BOOST: 1.10, // +10%
  SWITCH_VS_ISO: 0.96, // -4%
  ELITE_PERIMETER_VS_SHOOTER: 0.94, // -6%
  WEAK_PAINT_VS_BIG: 1.08 // +8%
};

export const VARIANCE_MODELING = {
  STAR_BASE_VARIANCE: 0.25, // 25% for stars
  ROLE_BASE_VARIANCE: 0.35, // 35% for role players
  TEAM_BASE_VARIANCE: 0.08, // 8% for teams

  // Context multipliers
  INJURY_UNCERTAINTY_MULTIPLIER: 1.5,
  PACE_VOLATILITY_MULTIPLIER: 1.2,
  MINUTES_UNCERTAINTY_MULTIPLIER: 1.3,
  MATCHUP_UNCERTAINTY_MULTIPLIER: 1.15,
  MAJOR_INJURIES_MULTIPLIER: 1.4,
  BACK_TO_BACK_MULTIPLIER: 1.2
};

export const HOME_ADVANTAGE = {
  DEFAULT: 2.5,
  MAX: 8.0,
  MIN_GAMES_FOR_SPLIT: 3 // Minimum home/away games to use split records
};

export const WORKERS = {
  games: 'https://nba-worker-games.scottcinatl.workers.dev',
  teams: 'https://nba-worker-teams.scottcinatl.workers.dev',
  players: 'https://nba-worker-players.scottcinatl.workers.dev',
  injuries: 'https://nba-worker-injuries.scottcinatl.workers.dev',
  gamenotes: 'https://nba-worker-gamenotes.scottcinatl.workers.dev',
  injuriesOfficial: 'https://nba-worker-injuries-official.scottcinatl.workers.dev',
  lineups: 'https://nba-worker-lineups.scottcinatl.workers.dev',
  teamstyle: 'https://nba-worker-teamstyle.scottcinatl.workers.dev',
  results: 'https://nba-worker-results.scottcinatl.workers.dev'
};

export const NBA_SEASON_CONFIG = {
  SEASON_START_MONTH: 10, // October
  LAST_N_GAMES: 5 // Default lookback window
};

export const INJURY_REPORT_TIMES = [
  { hour: 0, minute: 0, format: '12AM' },   // 12:00 AM ET (shown as 12:30 AM on website)
  { hour: 1, minute: 0, format: '01AM' },   // 1:00 AM ET (shown as 1:30 AM on website)
  { hour: 2, minute: 0, format: '02AM' },   // 2:00 AM ET (shown as 2:30 AM on website)
  { hour: 3, minute: 0, format: '03AM' },   // 3:00 AM ET (shown as 3:30 AM on website)
  { hour: 4, minute: 0, format: '04AM' },   // 4:00 AM ET (shown as 4:30 AM on website)
  { hour: 5, minute: 0, format: '05AM' },   // 5:00 AM ET (shown as 5:30 AM on website)
  { hour: 6, minute: 0, format: '06AM' },   // 6:00 AM ET (shown as 6:30 AM on website)
  { hour: 7, minute: 0, format: '07AM' },   // 7:00 AM ET (shown as 7:30 AM on website)
  { hour: 8, minute: 0, format: '08AM' },   // 8:00 AM ET (shown as 8:30 AM on website)
  { hour: 9, minute: 0, format: '09AM' },   // 9:00 AM ET (shown as 9:30 AM on website)
  { hour: 10, minute: 0, format: '10AM' },  // 10:00 AM ET (shown as 10:30 AM on website)
  { hour: 11, minute: 0, format: '11AM' },  // 11:00 AM ET (shown as 11:30 AM on website)
  { hour: 12, minute: 0, format: '12PM' },  // 12:00 PM ET (shown as 12:30 PM on website)
  { hour: 13, minute: 0, format: '01PM' },  // 1:00 PM ET
  { hour: 14, minute: 0, format: '02PM' },  // 2:00 PM ET
  { hour: 15, minute: 0, format: '03PM' },  // 3:00 PM ET
  { hour: 16, minute: 0, format: '04PM' },  // 4:00 PM ET
  { hour: 17, minute: 0, format: '05PM' },  // 5:00 PM ET
  { hour: 18, minute: 0, format: '06PM' },  // 6:00 PM ET
  { hour: 19, minute: 0, format: '07PM' }   // 7:00 PM ET
];
