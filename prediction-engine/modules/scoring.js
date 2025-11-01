/**
 * Scoring Module
 * Handles all team score calculations including possession-based modeling
 */

import { POSSESSION_MODEL, SCHEDULE_ADJUSTMENTS } from '../config/constants.js';

/**
 * NEW PHASE 3: Calculate schedule context factors (rest, back-to-back, etc.)
 * Returns adjustment object with fatigue and rest advantage impacts
 */
export function calculateScheduleContext(teamData, oppData, gameDate) {
  const context = {
    teamFatigue: 0, // Negative = tired, positive = well-rested
    oppFatigue: 0,
    teamBackToBack: false,
    oppBackToBack: false,
    restAdvantage: 0, // Positive favors team, negative favors opponent
    adjustmentDesc: []
  };

  // TODO: In future, fetch actual schedule data from NBA API
  // For now, use estimated impacts based on typical NBA scheduling

  // PLACEHOLDER: These would be calculated from actual game dates
  // Example: if last game was yesterday, backToBack = true
  // Example: if team had 3 days rest, restAdvantage = +1.5

  // Back-to-back detection (simplified - would use actual schedule)
  // const lastGameDate = getLastGameDate(teamData);
  // const daysSinceLastGame = (gameDate - lastGameDate) / (1000 * 60 * 60 * 24);

  // For now, apply typical league-average adjustments
  // Will be enhanced when schedule API is integrated

  return context;
}

/**
 * Apply schedule context adjustments to team performance
 * Research shows: B2B games = -2 to -5 points, 3+ days rest = +1 to +2 points
 */
export function applyScheduleAdjustments(baseScore, scheduleContext) {
  let adjustedScore = baseScore;
  const adjustments = [];

  // Back-to-back game penalty
  if (scheduleContext.teamBackToBack) {
    const b2bPenalty = -3.5; // Average B2B impact
    adjustedScore += b2bPenalty;
    adjustments.push(`B2B: ${b2bPenalty.toFixed(1)}`);
  }

  // Rest advantage
  if (Math.abs(scheduleContext.restAdvantage) >= 1) {
    adjustedScore += scheduleContext.restAdvantage;
    adjustments.push(`Rest: ${scheduleContext.restAdvantage > 0 ? '+' : ''}${scheduleContext.restAdvantage.toFixed(1)}`);
  }

  return {
    score: adjustedScore,
    adjustments: adjustments.length > 0 ? adjustments.join(', ') : null
  };
}

/**
 * NEW PHASE 3: Possession-based scoring model with proper statistical modeling
 * Replaces simplified formula with research-backed possession calculation
 */
export function calculatePossessionBasedScore(teamStats, oppStats, teamAdv, oppAdv, isHome, homeAdvantage, teamStrengthDiff, sophisticatedPace = null, gameScript = null, teamAbbr = null, scheduleContext = null) {
  // STEP 1: Calculate actual possessions using Four Factors
  // Formula: Pace * (48 / (teamMin + oppMin)) * 0.96
  // Adjusted for turnovers and offensive rebounds

  const basePace = sophisticatedPace || teamAdv.pace || 100;

  // Turnover impact on possessions (turnovers create/prevent possessions)
  const teamTOV = teamStats.turnovers || 14;
  const oppTOV = oppStats.turnovers || 14;
  const tovAdjustment = (oppTOV - teamTOV) * POSSESSION_MODEL.TURNOVER_WEIGHT;

  // Offensive rebound impact (OREBs create extra possessions)
  const teamOREB = teamStats.offensiveRebounds || 10;
  const oppDREB = oppStats.defensiveRebounds || 34;
  const orebImpact = Math.max(0, teamOREB - (oppDREB * 0.25)); // Extra OREs = possessions
  const orebAdjustment = orebImpact * POSSESSION_MODEL.OREB_WEIGHT;

  // Calculate expected possessions
  let possessions = basePace + tovAdjustment + orebAdjustment;

  // Ensure within reasonable bounds
  possessions = Math.max(POSSESSION_MODEL.PACE_BOUNDS.MIN, Math.min(POSSESSION_MODEL.PACE_BOUNDS.MAX, possessions));

  // NEW PHASE 3: Apply schedule context to pace (fatigue affects tempo)
  if (scheduleContext) {
    if (scheduleContext.teamBackToBack) {
      possessions += SCHEDULE_ADJUSTMENTS.BACK_TO_BACK_POSSESSIONS; // B2B teams play slower
    }
    // Rest advantage affects pace
    possessions += (scheduleContext.restAdvantage * SCHEDULE_ADJUSTMENTS.REST_POSSESSIONS_PER_DAY);
  }

  // STEP 2: Calculate offensive efficiency with non-linear defensive interaction
  const offRating = teamAdv.offensiveRating || 110;
  const oppDefRating = oppAdv.defensiveRating || 110;

  // Non-linear defensive impact (elite defense has exponential effect)
  // Formula: offRating * (110 / oppDefRating)^0.7
  const baseEfficiency = offRating / 110; // Normalize to 1.0
  const defAdjustment = Math.pow(110 / oppDefRating, POSSESSION_MODEL.DEFENSIVE_EXPONENT);
  const adjustedEfficiency = baseEfficiency * defAdjustment;

  // STEP 3: Calculate points per possession (PPP)
  let pointsPerPossession = adjustedEfficiency * POSSESSION_MODEL.NBA_AVERAGE_PPP;

  // NEW PHASE 3: Apply schedule context to efficiency (fatigue affects shooting)
  if (scheduleContext) {
    if (scheduleContext.teamBackToBack) {
      pointsPerPossession *= SCHEDULE_ADJUSTMENTS.BACK_TO_BACK_EFFICIENCY; // -3% efficiency on B2B
    }
    // Rest advantage improves efficiency
    if (scheduleContext.restAdvantage > 0) {
      const restBoost = Math.min(
        scheduleContext.restAdvantage * SCHEDULE_ADJUSTMENTS.REST_EFFICIENCY_PER_DAY,
        SCHEDULE_ADJUSTMENTS.MAX_REST_EFFICIENCY_BOOST
      );
      pointsPerPossession *= (1 + restBoost);
    }
  }

  // STEP 4: Apply home court advantage to efficiency (not just flat points)
  if (isHome) {
    const homeBoost = (homeAdvantage || 2.5) / 100; // Convert points to efficiency boost
    pointsPerPossession *= (1 + homeBoost);
  }

  // STEP 5: Apply team strength differential to efficiency
  const strengthBoost = (isHome ? teamStrengthDiff : -teamStrengthDiff) / 100;
  pointsPerPossession *= (1 + (strengthBoost || 0));

  // STEP 6: Apply game script strategic advantages
  if (gameScript && teamAbbr) {
    let efficiencyBoost = 0;

    gameScript.keyBattles.forEach(battle => {
      if (battle.advantage === teamAbbr) {
        // Paint advantage = more efficient shots (higher PPP)
        if (battle.type === "Interior Battle") {
          efficiencyBoost += battle.confidence === "High" ? 0.03 : 0.015; // +3% or +1.5% efficiency
        }
        // Perimeter advantage = more three-pointers (higher PPP)
        else if (battle.type === "Perimeter Shooting") {
          efficiencyBoost += battle.confidence === "High" ? 0.025 : 0.012; // +2.5% or +1.2% efficiency
        }
        // Pace advantage = already in possessions, but slight efficiency bump
        else if (battle.type === "Tempo Control") {
          efficiencyBoost += battle.confidence === "High" ? 0.01 : 0.005;
          // Also increase possessions
          possessions += battle.confidence === "High" ? 2 : 1;
        }
      }
    });

    pointsPerPossession *= (1 + efficiencyBoost);
  }

  // STEP 7: Calculate final expected score
  const expectedScore = possessions * pointsPerPossession;

  return {
    score: Math.round(expectedScore),
    possessions: Math.round(possessions * 10) / 10, // Round to 1 decimal
    efficiency: Math.round(pointsPerPossession * 100) / 100, // Round to 2 decimals
    breakdown: {
      basePace,
      tovAdjustment: Math.round(tovAdjustment * 10) / 10,
      orebAdjustment: Math.round(orebAdjustment * 10) / 10,
      offRating,
      oppDefRating,
      adjustedEfficiency: Math.round(adjustedEfficiency * 100) / 100
    }
  };
}

/**
 * LEGACY: Calculate predicted score with ratings, pace, and game script feedback
 * DEPRECATED - Use calculatePossessionBasedScore for better accuracy
 * Kept for backwards compatibility
 */
export function calculatePredictedScore(teamAdv, oppAdv, isHome, homeAdvantage, teamStrengthDiff, sophisticatedPace = null, gameScript = null, teamAbbr = null) {
  const offRating = teamAdv.offensiveRating || 110;
  const oppDefRating = oppAdv.defensiveRating || 110;

  // Use sophisticated pace if provided, otherwise fall back to simple calculation
  const pace = sophisticatedPace || ((teamAdv.pace || 100) + (oppAdv.pace || 100)) / 2;

  // Base score calculation
  let baseScore = ((offRating + (110 - (oppDefRating - 110))) / 2) * (pace / 100);

  // Apply dynamic home court advantage (passed in, not fixed 2.5)
  if (isHome) {
    baseScore += homeAdvantage || 2.5; // Fallback to 2.5 if not provided
  }

  // Apply team strength differential (positive = favor this team)
  const strengthAdjustment = isHome ? (teamStrengthDiff || 0) : -(teamStrengthDiff || 0);
  baseScore += strengthAdjustment;

  // NEW: Apply game script strategic advantages to team score
  if (gameScript && teamAbbr) {
    gameScript.keyBattles.forEach(battle => {
      if (battle.advantage === teamAbbr) {
        let scriptAdjustment = 0;

        // Paint advantage = more efficient shots
        if (battle.type === "Interior Battle") {
          scriptAdjustment = battle.confidence === "High" ? 3 : 1.5;
        }
        // Perimeter advantage = more three-pointers
        else if (battle.type === "Perimeter Shooting") {
          scriptAdjustment = battle.confidence === "High" ? 2.5 : 1.2;
        }
        // Pace advantage = more possessions
        else if (battle.type === "Tempo Control") {
          scriptAdjustment = battle.confidence === "High" ? 2 : 1;
        }

        baseScore += scriptAdjustment;
      }
    });
  }

  return Math.round(baseScore);
}

/**
 * Calculate win probability from point differential
 * Based on NBA historical data
 */
export function calculateWinProbability(marginDiff) {
  // Convert point differential to win probability
  // Based on NBA historical data
  return 1 / (1 + Math.exp(-marginDiff * 0.15));
}
