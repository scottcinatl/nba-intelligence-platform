/**
 * Analysis Module
 * Handles game script analysis, opponent defense analysis, pace calculation, and variance modeling
 */

import { OPPONENT_DEFENSE, VARIANCE_MODELING, GAME_SCRIPT_THRESHOLDS, GAME_SCRIPT_ADJUSTMENTS } from '../config/constants.js';

/**
 * NEW PHASE 3: Analyze opponent defensive characteristics
 * Identifies defensive strengths/weaknesses for matchup-specific adjustments
 */
export function analyzeOpponentDefense(oppStats, oppAdv, oppStyle) {
  const defense = {
    hasEliteRimProtector: false,
    blocksPerGame: oppStats.blocks || 4.5,
    switchHeavy: false,
    zonesFrequently: false,
    perimeter3PDefense: oppStats.opponent3PPercent || 0.36,
    paintDefense: oppStats.oppPaintPts || 48,
    pickAndRollCoverage: 'standard', // 'blitz', 'drop', 'switch', or 'standard'
    closeoutSpeed: 'average' // 'elite', 'good', 'average', 'poor'
  };

  // Elite rim protector detection (5+ blocks per game)
  if (defense.blocksPerGame >= OPPONENT_DEFENSE.ELITE_RIM_PROTECTOR_BPG) {
    defense.hasEliteRimProtector = true;
  }

  // Zone defense detection (weak perimeter defense often indicates zone)
  if (defense.perimeter3PDefense > OPPONENT_DEFENSE.ZONE_DEFENSE_3P_THRESHOLD) {
    defense.zonesFrequently = true;
    defense.closeoutSpeed = 'poor';
  }

  // Switch-heavy detection (good defensive rating with high opponent assists)
  const oppAssists = oppStats.opponentAssists || 24;
  if (oppAdv.defensiveRating < OPPONENT_DEFENSE.SWITCH_HEAVY_DEF_RATING &&
      oppAssists < OPPONENT_DEFENSE.SWITCH_HEAVY_OPP_ASSISTS) {
    defense.switchHeavy = true; // Forces teams into isolation
  }

  // Elite perimeter defense
  if (defense.perimeter3PDefense < OPPONENT_DEFENSE.ELITE_PERIMETER_3P_THRESHOLD) {
    defense.closeoutSpeed = 'elite';
  }

  return defense;
}

/**
 * NEW PHASE 3: Apply opponent-specific defensive adjustments to player
 * Adjusts projections based on player style vs opponent defensive strengths
 */
export function applyOpponentDefensiveAdjustment(player, opponentDefense, playerIndex) {
  let adjustmentMultiplier = 1.0;
  const adjustments = [];

  // Get player tendencies (simplified - would be enhanced with play-type data)
  const isDriveHeavy = (player.position === 'PG' || player.position === 'SG') && player.points > 15;
  const isShooter = player.threePointersMade > 1.5;
  const isPostPlayer = (player.position === 'C' || player.position === 'PF') && player.points > 12;

  // ADJUSTMENT 1: Elite rim protector vs drivers
  if (opponentDefense.hasEliteRimProtector && isDriveHeavy) {
    adjustmentMultiplier *= OPPONENT_DEFENSE.RIM_PROTECTOR_VS_DRIVER;
    adjustments.push('Elite rim protection (-7%)');
    // But more fouls drawn
    if (player.freeThrowsAttempted) {
      player.freeThrowsAttempted *= OPPONENT_DEFENSE.RIM_PROTECTOR_FTA_BOOST;
    }
  }

  // ADJUSTMENT 2: Zone defense vs shooters
  if (opponentDefense.zonesFrequently && isShooter) {
    adjustmentMultiplier *= OPPONENT_DEFENSE.ZONE_VS_SHOOTER;
    adjustments.push('Zone defense (+5% 3PT)');
    if (player.threePointersAttempted) {
      player.threePointersAttempted *= OPPONENT_DEFENSE.ZONE_3PA_BOOST;
    }
  }

  // ADJUSTMENT 3: Switch-heavy defense vs isolation players
  const isIsoPlayer = playerIndex <= 1 && player.usage > 0.25; // Primary scorers
  if (opponentDefense.switchHeavy && isIsoPlayer) {
    adjustmentMultiplier *= OPPONENT_DEFENSE.SWITCH_VS_ISO;
    adjustments.push('Switch-heavy D (-4%)');
  }

  // ADJUSTMENT 4: Elite perimeter defense vs shooters
  if (opponentDefense.closeoutSpeed === 'elite' && isShooter) {
    adjustmentMultiplier *= OPPONENT_DEFENSE.ELITE_PERIMETER_VS_SHOOTER;
    adjustments.push('Elite closeouts (-6%)');
  }

  // ADJUSTMENT 5: Weak paint defense vs post players
  if (opponentDefense.paintDefense > OPPONENT_DEFENSE.WEAK_PAINT_DEFENSE && isPostPlayer) {
    adjustmentMultiplier *= OPPONENT_DEFENSE.WEAK_PAINT_VS_BIG;
    adjustments.push('Weak paint D (+8%)');
  }

  return {
    multiplier: adjustmentMultiplier,
    adjustments,
    freeThrowBoost: opponentDefense.hasEliteRimProtector && isDriveHeavy ? OPPONENT_DEFENSE.RIM_PROTECTOR_FTA_BOOST : 1.0
  };
}

/**
 * Generate game script analysis - Phase 1: Statistical Mismatch Detection
 */
export function generateGameScriptAnalysis(awayData, homeData, awayStyle, homeStyle) {
  const gameScript = {
    keyBattles: [],
    strategicInsights: [],
    predictedApproaches: [],
    confidence: 'Conservative' // Phase 1 is intentionally conservative
  };

  // Get team stats for mismatch analysis
  const awayStats = awayData.stats?.general || {};
  const homeStats = homeData.stats?.general || {};
  const awayAdv = awayData.stats?.advanced || {};
  const homeAdv = homeData.stats?.advanced || {};

  // MISMATCH 1: Paint Scoring vs Paint Defense
  const awayPaintScoring = awayStats.paintPts || 0;
  const homePaintDefense = homeStats.oppPaintPts || 48; // Opponent paint points allowed
  const paintDifferential = awayPaintScoring - homePaintDefense;

  if (Math.abs(paintDifferential) > GAME_SCRIPT_THRESHOLDS.PAINT_DIFFERENTIAL_MEDIUM) {
    const advantageTeam = paintDifferential > 0 ? awayData.team.abbreviation : homeData.team.abbreviation;
    const disadvantageTeam = paintDifferential > 0 ? homeData.team.abbreviation : awayData.team.abbreviation;

    gameScript.keyBattles.push({
      type: "Interior Battle",
      advantage: advantageTeam,
      differential: Math.abs(paintDifferential).toFixed(1),
      confidence: Math.abs(paintDifferential) > GAME_SCRIPT_THRESHOLDS.PAINT_DIFFERENTIAL_HIGH ? "High" : "Medium"
    });

    if (paintDifferential > 0) {
      gameScript.strategicInsights.push(`${advantageTeam} should attack the paint aggressively - statistical advantage of ${paintDifferential.toFixed(1)} points per game`);
      gameScript.predictedApproaches.push(`${advantageTeam} likely to establish interior presence early`);
    } else {
      gameScript.strategicInsights.push(`${disadvantageTeam} should avoid paint congestion - statistical disadvantage suggests perimeter focus`);
    }
  }

  // MISMATCH 2: Pace Battle
  const awayPace = awayAdv.pace || 100;
  const homePace = homeAdv.pace || 100;
  const paceDifferential = Math.abs(awayPace - homePace);

  if (paceDifferential > GAME_SCRIPT_THRESHOLDS.PACE_DIFFERENTIAL_MEDIUM) {
    const fasterTeam = awayPace > homePace ? awayData.team.abbreviation : homeData.team.abbreviation;
    const slowerTeam = awayPace < homePace ? awayData.team.abbreviation : homeData.team.abbreviation;

    gameScript.keyBattles.push({
      type: "Tempo Control",
      advantage: fasterTeam,
      differential: paceDifferential.toFixed(1),
      confidence: paceDifferential > GAME_SCRIPT_THRESHOLDS.PACE_DIFFERENTIAL_HIGH ? "High" : "Medium"
    });

    gameScript.strategicInsights.push(`${fasterTeam} should push pace in transition - ${paceDifferential.toFixed(1)} possession advantage per game`);
    gameScript.predictedApproaches.push(`Pace battle will be decisive: ${fasterTeam} pushes vs ${slowerTeam} controls`);
  }

  // MISMATCH 3: Three-Point Shooting vs Defense
  const awayThreeRate = (awayStats.threePointersMade / awayStats.fieldGoalsAttempted) || 0;
  const homeThreeDefense = homeStats.oppThreePointPct || 0.36;
  const threePointAdvantage = awayThreeRate - homeThreeDefense;

  if (Math.abs(threePointAdvantage) > GAME_SCRIPT_THRESHOLDS.THREE_POINT_DIFFERENTIAL_MEDIUM) {
    const advantageTeam = threePointAdvantage > 0 ? awayData.team.abbreviation : homeData.team.abbreviation;

    gameScript.keyBattles.push({
      type: "Perimeter Shooting",
      advantage: advantageTeam,
      differential: `${(Math.abs(threePointAdvantage) * 100).toFixed(1)}%`,
      confidence: Math.abs(threePointAdvantage) > GAME_SCRIPT_THRESHOLDS.THREE_POINT_DIFFERENTIAL_HIGH ? "High" : "Medium"
    });

    if (threePointAdvantage > 0) {
      gameScript.strategicInsights.push(`${advantageTeam} should emphasize three-point attempts - shooting advantage of ${(threePointAdvantage * 100).toFixed(1)}%`);
    }
  }

  // MISMATCH 4: Assist Rate vs Turnover Defense
  const awayAssistRate = (awayStats.assists / awayStats.fieldGoalsMade) || 0;
  const homeTurnoverDefense = homeStats.opponentTurnovers || 14;

  if (awayAssistRate > 0.65 && homeTurnoverDefense < 13) {
    gameScript.keyBattles.push({
      type: "Ball Movement vs Pressure",
      advantage: awayData.team.abbreviation,
      differential: "Ball movement system vs weak pressure defense",
      confidence: "Medium"
    });

    gameScript.strategicInsights.push(`${awayData.team.abbreviation} should exploit ball movement - high assist rate vs limited defensive pressure`);
  }

  // TEAM STYLE ENHANCEMENTS (when available)
  if (awayStyle.success && homeStyle.success) {
    const awayStyleProfile = awayStyle.profile;
    const homeStyleProfile = homeStyle.profile;

    // Enhanced three-point analysis with style data
    if (awayStyleProfile.offensiveStyle?.shotSelection && homeStyleProfile.defensiveStyle) {
      const awayThreeStyle = awayStyleProfile.offensiveStyle.shotSelection.threePointRate;
      const homeThreeDefenseStyle = homeStyleProfile.defensiveStyle.opponentThreePointPct;

      if (awayThreeStyle > 0.42 && homeThreeDefenseStyle > 0.37) {
        gameScript.strategicInsights.push(`${awayData.team.abbreviation} three-point volume (${(awayThreeStyle * 100).toFixed(1)}%) vs ${homeData.team.abbreviation} perimeter weakness creates high-volume shooting opportunity`);
      }
    }
  }

  // Generate overall game approach prediction
  if (gameScript.keyBattles.length > 0) {
    const dominantAdvantage = gameScript.keyBattles.find(battle => battle.confidence === "High");
    if (dominantAdvantage) {
      gameScript.predictedApproaches.push(`Primary strategic focus: ${dominantAdvantage.type} - ${dominantAdvantage.advantage} holds decisive advantage`);
    }
  }

  return gameScript;
}

/**
 * Apply game script insights to player projections
 */
export function applyGameScriptToProjections(players, gameScript, teamAbbr) {
  return players.map(player => {
    let scriptBoost = 0;
    let scriptReasons = [];

    // Apply paint advantage to interior players
    const paintAdvantage = gameScript.keyBattles.find(battle =>
      battle.type === "Interior Battle" && battle.advantage === teamAbbr
    );
    if (paintAdvantage && (player.position === 'C' || player.position === 'PF')) {
      const boost = paintAdvantage.confidence === "High" ? GAME_SCRIPT_ADJUSTMENTS.INTERIOR_HIGH : GAME_SCRIPT_ADJUSTMENTS.INTERIOR_MEDIUM;
      scriptBoost += boost;
      scriptReasons.push(`paint advantage (+${boost.toFixed(1)})`);
    }

    // Apply pace advantage to guards and wings
    const paceAdvantage = gameScript.keyBattles.find(battle =>
      battle.type === "Tempo Control" && battle.advantage === teamAbbr
    );
    if (paceAdvantage && (player.position === 'PG' || player.position === 'SG' || player.position === 'SF')) {
      const boost = paceAdvantage.confidence === "High" ? GAME_SCRIPT_ADJUSTMENTS.TEMPO_HIGH : GAME_SCRIPT_ADJUSTMENTS.TEMPO_MEDIUM;
      scriptBoost += boost;
      scriptReasons.push(`pace advantage (+${boost.toFixed(1)})`);
    }

    // Apply three-point advantage to perimeter players
    const threeAdvantage = gameScript.keyBattles.find(battle =>
      battle.type === "Perimeter Shooting" && battle.advantage === teamAbbr
    );
    if (threeAdvantage && player.threePointersMade > 1.0) {
      const boost = threeAdvantage.confidence === "High" ? GAME_SCRIPT_ADJUSTMENTS.PERIMETER_HIGH : GAME_SCRIPT_ADJUSTMENTS.PERIMETER_MEDIUM;
      scriptBoost += boost;
      scriptReasons.push(`perimeter advantage (+${boost.toFixed(1)})`);
    }

    return {
      ...player,
      gameScriptBoost: scriptBoost,
      gameScriptReasons: scriptReasons
    };
  });
}

/**
 * Calculate sophisticated pace prediction using all available data layers
 */
export function calculateSophisticatedPace(awayData, homeData, context = {}) {
  const paceCalculation = {
    base: 100,
    breakdown: [],
    confidence: 'Medium',
    dataLayers: 0
  };

  // LAYER 1: Team Stats Pace (Foundation - Always Available)
  const awayTeamPace = awayData.stats?.advanced?.pace;
  const homeTeamPace = homeData.stats?.advanced?.pace;

  if (awayTeamPace && homeTeamPace) {
    // Base calculation with home court weighting (55% home control)
    paceCalculation.base = (awayTeamPace * 0.45) + (homeTeamPace * 0.55);
    paceCalculation.breakdown.push(`Team stats: ${awayTeamPace.toFixed(1)} vs ${homeTeamPace.toFixed(1)}`);
    paceCalculation.dataLayers++;

    // Home court pace control bonus
    const homeCourtBonus = Math.min(1.5, (homeTeamPace - awayTeamPace) * 0.3);
    paceCalculation.base += homeCourtBonus;
    if (Math.abs(homeCourtBonus) > 0.5) {
      paceCalculation.breakdown.push(`Home control: +${homeCourtBonus.toFixed(1)}`);
    }
  }

  // LAYER 2: Team Style Pace (When Available)
  if (awayData.teamStyle?.success && homeData.teamStyle?.success) {
    const awayStylePace = awayData.teamStyle.profile?.offensiveStyle?.pace;
    const homeStylePace = homeData.teamStyle.profile?.offensiveStyle?.pace;

    if (awayStylePace && homeStylePace) {
      // Style pace represents more recent tendencies
      const stylePaceAvg = (awayStylePace * 0.45) + (homeStylePace * 0.55);
      const styleWeight = 0.3; // 30% weight for style pace

      paceCalculation.base = (paceCalculation.base * 0.7) + (stylePaceAvg * styleWeight);
      paceCalculation.breakdown.push(`Style pace: ${awayStylePace.toFixed(1)} vs ${homeStylePace.toFixed(1)}`);
      paceCalculation.dataLayers++;
      paceCalculation.confidence = 'High';
    }
  }

  // LAYER 3: Lineup Pace Intelligence (When Available)
  if (awayData.lineups?.success && homeData.lineups?.success) {
    const awayLineupPace = awayData.lineups.rotationIntelligence?.startingLineup?.pace;
    const homeLineupPace = homeData.lineups.rotationIntelligence?.startingLineup?.pace;

    if (awayLineupPace && homeLineupPace) {
      // Lineup pace represents specific unit tendencies
      const lineupPaceGap = Math.abs(awayLineupPace - homeLineupPace);

      if (lineupPaceGap > 3) {
        const paceAdjustment = lineupPaceGap * 0.2; // Moderate adjustment for lineup clash
        const fasterLineupIsHome = homeLineupPace > awayLineupPace;

        if (fasterLineupIsHome) {
          paceCalculation.base += paceAdjustment;
        } else {
          paceCalculation.base -= paceAdjustment * 0.5; // Away team has less control
        }

        paceCalculation.breakdown.push(`Lineup clash: ${paceAdjustment.toFixed(1)} adjustment`);
      }
      paceCalculation.dataLayers++;
    }
  }

  // LAYER 4: Contextual Adjustments
  if (context.backToBack) {
    paceCalculation.base -= 2.0;
    paceCalculation.breakdown.push('Back-to-back: -2.0');
  }

  if (context.overtimeLikely) {
    paceCalculation.base -= 1.5;
    paceCalculation.breakdown.push('Overtime expected: -1.5');
  }

  // Rest advantage (future enhancement)
  if (context.restAdvantage) {
    const restBonus = context.restAdvantage * 0.5;
    paceCalculation.base += restBonus;
    paceCalculation.breakdown.push(`Rest advantage: +${restBonus.toFixed(1)}`);
  }

  // CONFIDENCE CALCULATION
  if (paceCalculation.dataLayers >= 3) {
    paceCalculation.confidence = 'Very High';
  } else if (paceCalculation.dataLayers >= 2) {
    paceCalculation.confidence = 'High';
  } else if (paceCalculation.dataLayers >= 1) {
    paceCalculation.confidence = 'Medium';
  } else {
    paceCalculation.confidence = 'Low';
    paceCalculation.base = 100; // NBA average fallback
    paceCalculation.breakdown.push('Using NBA average (no team data)');
  }

  // Ensure reasonable bounds (85-115 pace range)
  paceCalculation.base = Math.max(85, Math.min(115, paceCalculation.base));

  return paceCalculation;
}

/**
 * NEW PHASE 3: Calculate statistical variance and confidence intervals
 * Replaces arbitrary ranges with proper statistical modeling
 */
export function calculatePlayerVariance(player, contextFactors = {}) {
  // STEP 1: Calculate base standard deviation from recent games
  let baseStdDev;

  if (player.recentGames && player.recentGames.length >= 3) {
    // Calculate actual std dev from recent performances
    const recentPoints = player.recentGames.map(g => g.points);
    const mean = recentPoints.reduce((a, b) => a + b) / recentPoints.length;
    const variance = recentPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentPoints.length;
    baseStdDev = Math.sqrt(variance);
  } else {
    // Estimate std dev based on player tier and points
    const pointsAvg = player.points || 10;
    if (player.impact?.tier === 'Superstar' || player.impact?.tier === 'Star') {
      baseStdDev = pointsAvg * VARIANCE_MODELING.STAR_BASE_VARIANCE;
    } else {
      baseStdDev = pointsAvg * VARIANCE_MODELING.ROLE_BASE_VARIANCE;
    }
  }

  // STEP 2: Apply context multipliers to variance
  let varianceMultiplier = 1.0;
  const varianceReasons = [];

  // Injury uncertainty increases variance
  if (contextFactors.injuryUncertainty > 0.3) {
    varianceMultiplier *= VARIANCE_MODELING.INJURY_UNCERTAINTY_MULTIPLIER;
    varianceReasons.push('Injury uncertainty');
  }

  // Pace volatility increases variance
  if (contextFactors.paceVolatility > 5) {
    varianceMultiplier *= VARIANCE_MODELING.PACE_VOLATILITY_MULTIPLIER;
    varianceReasons.push('Pace volatility');
  }

  // Minutes uncertainty (role player with inconsistent minutes)
  if (player.minutesVolatility && player.minutesVolatility > 5) {
    varianceMultiplier *= VARIANCE_MODELING.MINUTES_UNCERTAINTY_MULTIPLIER;
    varianceReasons.push('Minutes uncertainty');
  }

  // Matchup uncertainty (new opponent, unusual style)
  if (contextFactors.matchupUncertainty) {
    varianceMultiplier *= VARIANCE_MODELING.MATCHUP_UNCERTAINTY_MULTIPLIER;
    varianceReasons.push('Matchup uncertainty');
  }

  const adjustedStdDev = baseStdDev * varianceMultiplier;

  // STEP 3: Calculate confidence intervals
  const mean = player.points || 10;

  return {
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(adjustedStdDev * 10) / 10,
    // 68% confidence interval (±1 std dev)
    confidence68: {
      lower: Math.max(0, Math.round((mean - adjustedStdDev) * 10) / 10),
      upper: Math.round((mean + adjustedStdDev) * 10) / 10
    },
    // 95% confidence interval (±2 std dev)
    confidence95: {
      lower: Math.max(0, Math.round((mean - 2 * adjustedStdDev) * 10) / 10),
      upper: Math.round((mean + 2 * adjustedStdDev) * 10) / 10
    },
    varianceFactors: varianceReasons
  };
}

/**
 * NEW PHASE 3: Calculate game-level variance (for team scores)
 */
export function calculateGameVariance(teamStats, opponentStats, contextFactors = {}) {
  // Base variance from recent scoring consistency
  const avgPoints = teamStats.points || 110;
  let baseStdDev = avgPoints * VARIANCE_MODELING.TEAM_BASE_VARIANCE;

  // Adjust for pace volatility
  if (contextFactors.paceVolatility > 5) {
    baseStdDev *= 1.3; // Higher pace variance = higher scoring variance
  }

  // Adjust for injury count
  if (contextFactors.majorInjuries > 1) {
    baseStdDev *= VARIANCE_MODELING.MAJOR_INJURIES_MULTIPLIER;
  }

  // Adjust for back-to-back
  if (contextFactors.backToBack) {
    baseStdDev *= VARIANCE_MODELING.BACK_TO_BACK_MULTIPLIER;
  }

  return {
    stdDev: Math.round(baseStdDev * 10) / 10,
    confidence68: {
      lower: Math.round(avgPoints - baseStdDev),
      upper: Math.round(avgPoints + baseStdDev)
    },
    confidence95: {
      lower: Math.round(avgPoints - 2 * baseStdDev),
      upper: Math.round(avgPoints + 2 * baseStdDev)
    }
  };
}
