/**
 * Injuries Module
 * Handles all injury impact calculations including probability-weighted projections and teammate boosts
 */

import { IMPACT_SCORE_THRESHOLDS, IMPACT_SCORE_WEIGHTS, INJURY_STATUS_IMPACTS, INJURY_BOOST_MULTIPLIERS } from '../config/constants.js';

/**
 * Normalize player name for matching
 */
export function normalizePlayerName(name) {
  if (!name) return '';

  // Remove extra whitespace and convert to lowercase
  const cleaned = name.trim().toLowerCase();

  // Handle "Last, First" format by converting to "First Last"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(part => part.trim());
    if (parts.length >= 2) {
      // Convert "Last, First" to "First Last"
      return `${parts[1]} ${parts[0]}`;
    }
  }

  return cleaned;
}

/**
 * Check if two player names match, handling different formats
 */
export function playersMatch(playerName, injuryName) {
  if (!playerName || !injuryName) return false;

  const normalizedPlayer = normalizePlayerName(playerName);
  const normalizedInjury = normalizePlayerName(injuryName);

  // Direct match
  if (normalizedPlayer === normalizedInjury) return true;

  // Check if either name contains the other (handles middle names, Jr., etc.)
  if (normalizedPlayer.includes(normalizedInjury) || normalizedInjury.includes(normalizedPlayer)) {
    return true;
  }

  // Split names and check for overlap (handles different ordering)
  const playerWords = normalizedPlayer.split(' ').filter(word => word.length > 2);
  const injuryWords = normalizedInjury.split(' ').filter(word => word.length > 2);

  // Need at least 2 matching words for a match
  const matchingWords = playerWords.filter(word =>
    injuryWords.some(injWord => word === injWord || word.includes(injWord) || injWord.includes(word))
  );

  return matchingWords.length >= 2;
}

/**
 * Analyze player role elevation compared to season average
 */
export function analyzePlayerRoleElevation(player) {
  if (!player.seasonAverages || !player.recentForm) {
    return {
      minutesChange: 0,
      usageChange: 0,
      isElevated: false,
      elevationMagnitude: 0
    };
  }

  const seasonAvg = player.seasonAverages;
  const recentForm = player.recentForm; // Last 3 games

  // Research-based thresholds
  const significantMinutesThreshold = 15; // Research: 10+ minutes is significant
  const elevationThreshold = 1.2; // 20% increase in minutes
  const usageElevationThreshold = 1.15; // 15% increase in usage

  const minutesChange = (recentForm.minutes || 0) - (seasonAvg.minutes || 0);
  const usageChange = (recentForm.usage || 0) - (seasonAvg.usage || 0);

  // Player is "elevated" if:
  // 1. Playing significantly more minutes than season average (20%+ increase)
  // 2. Getting at least 15+ minutes per game recently
  // 3. Usage rate has increased by 15%+
  const isElevated = (
    recentForm.minutes > Math.max(seasonAvg.minutes * elevationThreshold, significantMinutesThreshold) &&
    recentForm.usage > seasonAvg.usage * usageElevationThreshold
  );

  const elevationMagnitude = seasonAvg.minutes > 0 ?
    (recentForm.minutes - seasonAvg.minutes) / seasonAvg.minutes : 0;

  return {
    minutesChange,
    usageChange,
    isElevated,
    elevationMagnitude
  };
}

/**
 * Calculate the impact of a returning player on teammates based on role elevation
 * Uses research-backed methodology for measuring rotation changes
 */
export function calculateReturnImpact(returningPlayer, teammate, teammateElevation) {
  if (!teammateElevation.isElevated) {
    return {
      adjustment: 0,
      reason: 'No elevation detected'
    };
  }

  // Base impact based on returning player's tier (research-backed tiers)
  let baseImpact = 0;
  switch (returningPlayer.impact.tier) {
    case 'Superstar':
      baseImpact = INJURY_BOOST_MULTIPLIERS.SUPERSTAR_RETURN;
      break;
    case 'Star':
      baseImpact = INJURY_BOOST_MULTIPLIERS.STAR_RETURN;
      break;
    case 'Key Role':
      baseImpact = INJURY_BOOST_MULTIPLIERS.KEY_ROLE_RETURN;
      break;
    default:
      baseImpact = -0.03; // -3% minimal impact
  }

  // Scale by teammate's elevation magnitude (cap at 2x for extreme cases)
  const elevationFactor = Math.min(Math.max(teammateElevation.elevationMagnitude, 0.1), 2.0);

  // Position-based adjustments (research shows guards vs bigs have different dynamics)
  let positionFactor = 1.0;
  if (teammate.position && returningPlayer.position) {
    // Same position = higher impact
    if (teammate.position === returningPlayer.position) {
      positionFactor = 1.3;
    }
    // Guard returning affects other guards more than bigs
    else if (returningPlayer.position.includes('G') && teammate.position.includes('G')) {
      positionFactor = 1.2;
    }
  }

  const finalAdjustment = baseImpact * elevationFactor * positionFactor;

  const reason = `${returningPlayer.playerName} (${returningPlayer.impact.tier}) returning, ` +
    `${teammate.playerName} elevated ${Math.round(teammateElevation.elevationMagnitude * 100)}%`;

  return {
    adjustment: finalAdjustment,
    reason: reason
  };
}

/**
 * Enhance player data with season averages and recent form analysis
 */
export function enhancePlayerData(players) {
  return players.map(player => {
    // For now, simulate season vs recent form comparison
    // In production, this would come from your player stats API with different time ranges
    const seasonAvg = {
      minutes: player.minutes * 0.9, // Assume season average is 90% of current
      usage: (player.usage || 20) * 0.95, // Assume recent form is elevated
      points: player.points * 0.92,
      assists: player.assists * 0.94,
      rebounds: player.rebounds * 0.96
    };

    const recentForm = {
      minutes: player.minutes,
      usage: player.usage || 20,
      points: player.points,
      assists: player.assists,
      rebounds: player.rebounds
    };

    const roleAnalysis = analyzePlayerRoleElevation({
      seasonAverages: seasonAvg,
      recentForm: recentForm
    });

    return {
      ...player,
      seasonAverages: seasonAvg,
      recentForm: recentForm,
      roleAnalysis: roleAnalysis
    };
  });
}

/**
 * Check if a player has actually missed recent games (indicating they're truly returning)
 * For now, we'll use a heuristic based on minutes played and games data
 */
export function playerMissedRecentGames(player, teamStats) {
  // If we don't have enough data, be conservative
  if (!teamStats || !player.minutes) {
    return false;
  }

  // Heuristic: If player is getting normal rotation minutes (15+),
  // they probably haven't missed significant time
  const hasSignificantMinutes = player.minutes >= 15;

  // If they're playing 15+ minutes regularly, they're probably not "returning"
  // This catches cases like Jaylen Brown who's been playing all season
  if (hasSignificantMinutes) {
    return false;
  }

  // If playing < 15 minutes, might actually be returning from injury
  return true;
}

/**
 * Calculate player impact score for smart injury adjustments
 */
export function calculatePlayerImpact(player) {
  if (!player) return { score: 0, tier: 'Bench' };

  const pointsWeight = (player.points || 0) * IMPACT_SCORE_WEIGHTS.POINTS;
  const assistsWeight = (player.assists || 0) * IMPACT_SCORE_WEIGHTS.ASSISTS;
  const reboundsWeight = (player.rebounds || 0) * IMPACT_SCORE_WEIGHTS.REBOUNDS;
  const stealsWeight = (player.steals || 0) * IMPACT_SCORE_WEIGHTS.STEALS;
  const blocksWeight = (player.blocks || 0) * IMPACT_SCORE_WEIGHTS.BLOCKS;

  const impactScore = pointsWeight + assistsWeight + reboundsWeight +
                      stealsWeight + blocksWeight;

  let tier = 'Bench';
  if (impactScore > IMPACT_SCORE_THRESHOLDS.SUPERSTAR) tier = 'Superstar';
  else if (impactScore > IMPACT_SCORE_THRESHOLDS.STAR) tier = 'Star';
  else if (impactScore > IMPACT_SCORE_THRESHOLDS.KEY_ROLE) tier = 'Key Role';

  return {
    score: impactScore,
    tier: tier
  };
}

/**
 * NEW: Calculate injury status impact with probability weighting and effectiveness reduction
 */
export function calculateInjuryStatusImpact(player, injury) {
  const impact = INJURY_STATUS_IMPACTS[injury.status] || { playProbability: 1.0, effectiveness: 1.0, description: 'Full availability' };

  // Calculate probability-weighted expectations
  const basePoints = player.points || 0;
  const baseMinutes = player.minutes || 0;
  const baseRebounds = player.rebounds || 0;
  const baseAssists = player.assists || 0;

  return {
    // Expected values (probability * effectiveness)
    expectedPoints: basePoints * impact.playProbability * impact.effectiveness,
    expectedMinutes: baseMinutes * impact.playProbability * impact.effectiveness,
    expectedRebounds: baseRebounds * impact.playProbability * impact.effectiveness,
    expectedAssists: baseAssists * impact.playProbability * impact.effectiveness,

    // Uncertainty and display info
    uncertainty: Math.max(0, 1.0 - impact.playProbability),
    playProbability: impact.playProbability,
    effectiveness: impact.effectiveness,
    displayNote: impact.playProbability < 1.0 ? `(${Math.round(impact.playProbability * 100)}% plays)` : '',
    statusDescription: impact.description,

    // Reduction amounts for teammate boost calculations
    pointsReduction: basePoints - (basePoints * impact.playProbability * impact.effectiveness),
    minutesReduction: baseMinutes - (baseMinutes * impact.playProbability * impact.effectiveness)
  };
}

/**
 * NEW: Calculate conditional teammate projections based on uncertain star availability
 * Implements proper cascading uncertainty - teammates get weighted boosts based on probability
 */
export function calculateConditionalProjection(player, injuries, playerImpacts) {
  // Find all uncertain star players on this team
  const uncertainStars = injuries.filter(inj =>
    ['questionable', 'doubtful'].includes(inj.status)
  );

  if (uncertainStars.length === 0) {
    return {
      expectedPoints: player.points,
      expectedAssists: player.assists,
      expectedRebounds: player.rebounds,
      uncertainty: 0,
      scenarios: []
    };
  }

  // Build probability tree for all scenarios
  const scenarios = [];

  // For simplicity, we'll handle the most impactful uncertain player
  // In a full implementation, we'd handle all combinations
  const mostImpactfulUncertain = uncertainStars
    .map(inj => {
      const injPlayer = playerImpacts.find(p => playersMatch(p.playerName, inj.playerName));
      return { injury: inj, player: injPlayer, impact: injPlayer?.impact?.score || 0 };
    })
    .filter(x => x.player)
    .sort((a, b) => b.impact - a.impact)[0];

  if (!mostImpactfulUncertain) {
    return {
      expectedPoints: player.points,
      expectedAssists: player.assists,
      expectedRebounds: player.rebounds,
      uncertainty: 0,
      scenarios: []
    };
  }

  const { injury, player: injuredStar } = mostImpactfulUncertain;
  const statusImpact = calculateInjuryStatusImpact(injuredStar, injury);
  const playProb = statusImpact.playProbability;

  // Scenario A: Star plays (playProb chance)
  const scenarioA = {
    probability: playProb,
    points: player.points * 1.03, // Small boost (star playing but limited)
    assists: player.assists * 1.03,
    rebounds: player.rebounds * 1.02,
    description: `${injuredStar.playerName} plays (${Math.round(playProb * 100)}%)`
  };

  // Scenario B: Star sits (1 - playProb chance)
  let boostIfOut = 1.0;
  if (injuredStar.impact?.tier === 'Superstar') {
    boostIfOut = 1 + INJURY_BOOST_MULTIPLIERS.SUPERSTAR_OUT;
  } else if (injuredStar.impact?.tier === 'Star') {
    boostIfOut = 1 + INJURY_BOOST_MULTIPLIERS.STAR_OUT;
  } else if (injuredStar.impact?.tier === 'Key Role') {
    boostIfOut = 1 + INJURY_BOOST_MULTIPLIERS.KEY_ROLE_OUT;
  }

  const scenarioB = {
    probability: 1 - playProb,
    points: player.points * boostIfOut,
    assists: player.assists * boostIfOut,
    rebounds: player.rebounds * boostIfOut * 0.8, // Rebounds scale less
    description: `${injuredStar.playerName} sits (${Math.round((1 - playProb) * 100)}%)`
  };

  scenarios.push(scenarioA, scenarioB);

  // Calculate expected value (weighted average)
  const expectedPoints = (scenarioA.points * scenarioA.probability) +
                        (scenarioB.points * scenarioB.probability);
  const expectedAssists = (scenarioA.assists * scenarioA.probability) +
                         (scenarioB.assists * scenarioB.probability);
  const expectedRebounds = (scenarioA.rebounds * scenarioA.probability) +
                          (scenarioB.rebounds * scenarioB.probability);

  // Uncertainty = variance between scenarios
  const uncertainty = Math.abs(scenarioB.points - scenarioA.points) / player.points;

  return {
    expectedPoints,
    expectedAssists,
    expectedRebounds,
    uncertainty,
    scenarios,
    conditionalBoostApplied: true,
    basedOn: `${injuredStar.playerName} ${injury.status}`
  };
}

/**
 * Simple injury impact logic for early season (< 10 games)
 */
export function applyEarlySeasonInjuryImpact(playersWithImpact, injuries, teamStats) {
  // Find injured players and categorize them
  const injuredPlayers = [];
  const returningPlayers = [];

  injuries.forEach(injury => {
    const player = playersWithImpact.find(p => playersMatch(p.playerName, injury.playerName));

    if (player) {
      if (injury.status === 'out' || injury.status === 'doubtful') {
        injuredPlayers.push({ ...player, injury });
      } else if (injury.status === 'probable' && player.impact.tier !== 'Bench') {
        // KEY FIX: Only apply return logic if player actually missed recent games
        if (playerMissedRecentGames(player, teamStats)) {
          returningPlayers.push({ ...player, injury });
        }
        // If they haven't missed games (like Jaylen Brown), don't apply return logic
      }
    }
  });

  // Apply enhanced adjustments with cascading probability weighting
  return playersWithImpact.map(player => {
    let adjustment = 0;
    let adjustmentNotes = [];

    // NEW: Check if this player has uncertain status (questionable/doubtful/probable)
    const playerInjury = injuries.find(inj => playersMatch(player.playerName, inj.playerName));
    if (playerInjury && ['questionable', 'doubtful', 'probable'].includes(playerInjury.status)) {
      const statusImpact = calculateInjuryStatusImpact(player, playerInjury);

      // Apply probability-weighted projections to the player themselves
      const adjustedPlayer = { ...player };
      adjustedPlayer.points = statusImpact.expectedPoints;
      adjustedPlayer.minutes = statusImpact.expectedMinutes;
      adjustedPlayer.rebounds = statusImpact.expectedRebounds;
      adjustedPlayer.assists = statusImpact.expectedAssists;

      adjustedPlayer.injuryAdjusted = `${playerInjury.status}: ${statusImpact.statusDescription}`;
      adjustedPlayer.statusNote = statusImpact.displayNote;
      adjustedPlayer.uncertainty = statusImpact.uncertainty;

      return adjustedPlayer;
    }

    // NEW: Check if teammates should get conditional boosts (star is questionable/doubtful)
    const conditionalProjection = calculateConditionalProjection(player, injuries, playersWithImpact);
    if (conditionalProjection.conditionalBoostApplied) {
      const adjustedPlayer = { ...player };
      adjustedPlayer.points = conditionalProjection.expectedPoints;
      adjustedPlayer.assists = conditionalProjection.expectedAssists;
      adjustedPlayer.rebounds = conditionalProjection.expectedRebounds;
      adjustedPlayer.uncertainty = conditionalProjection.uncertainty;
      adjustedPlayer.injuryAdjusted = `Conditional: ${conditionalProjection.basedOn}`;
      adjustedPlayer.conditionalScenarios = conditionalProjection.scenarios;

      return adjustedPlayer;
    }

    // POSITIVE ADJUSTMENTS: Boost when key players are definitively OUT
    injuredPlayers.forEach(injuredPlayer => {
      if (injuredPlayer.impact.tier !== 'Bench' && player.playerName !== injuredPlayer.playerName) {
        let boost = 0;

        switch (injuredPlayer.impact.tier) {
          case 'Superstar':
            boost = INJURY_BOOST_MULTIPLIERS.SUPERSTAR_OUT;
            break;
          case 'Star':
            boost = INJURY_BOOST_MULTIPLIERS.STAR_OUT;
            break;
          case 'Key Role':
            boost = INJURY_BOOST_MULTIPLIERS.KEY_ROLE_OUT;
            break;
        }

        // Top performers get extra boost
        if ((player.points || 0) >= 15 && (player.usage || 0) >= 18) {
          boost *= 1.2;
        }

        adjustment += boost;
        adjustmentNotes.push(`+${Math.round(boost * 100)}% (${injuredPlayer.playerName} out)`);
      }
    });

    // NEGATIVE ADJUSTMENTS: Small reduction when stars return (early season)
    returningPlayers.forEach(returningPlayer => {
      if (player.playerName !== returningPlayer.playerName) {
        let reduction = 0;

        switch (returningPlayer.impact.tier) {
          case 'Superstar':
            reduction = INJURY_BOOST_MULTIPLIERS.SUPERSTAR_RETURN;
            break;
          case 'Star':
            reduction = INJURY_BOOST_MULTIPLIERS.STAR_RETURN;
            break;
          case 'Key Role':
            reduction = INJURY_BOOST_MULTIPLIERS.KEY_ROLE_RETURN;
            break;
        }

        adjustment += reduction;
        adjustmentNotes.push(`${Math.round(reduction * 100)}% (${returningPlayer.playerName} returns)`);
      }
    });

    // Apply adjustments to stats
    if (adjustment !== 0) {
      const adjustedPlayer = { ...player };

      // Apply to key stats
      adjustedPlayer.points = (player.points || 0) * (1 + adjustment);
      adjustedPlayer.assists = (player.assists || 0) * (1 + adjustment);
      adjustedPlayer.rebounds = (player.rebounds || 0) * (1 + adjustment * 0.5);
      adjustedPlayer.usage = (player.usage || 0) * (1 + adjustment * 0.8);

      adjustedPlayer.injuryAdjusted = adjustmentNotes.join(', ');

      return adjustedPlayer;
    }

    return player;
  });
}

/**
 * Advanced injury impact logic using role elevation analysis (10+ games)
 */
export function applyAdvancedInjuryImpact(players, injuries, teamStats) {
  // Enhance player data with role analysis
  const playersWithRoleAnalysis = enhancePlayerData(players);

  // Find injured players and categorize them
  const injuredPlayers = [];
  const returningPlayers = [];

  injuries.forEach(injury => {
    const player = playersWithRoleAnalysis.find(p => playersMatch(p.playerName, injury.playerName));

    if (player) {
      if (injury.status === 'out' || injury.status === 'doubtful') {
        injuredPlayers.push({ ...player, injury });
      } else if (injury.status === 'probable' || injury.status === 'questionable') {
        if (player.impact.tier !== 'Bench') {
          returningPlayers.push({ ...player, injury });
        }
      }
    }
  });

  // Apply research-based adjustments
  return playersWithRoleAnalysis.map(player => {
    let adjustment = 0;
    let adjustmentNotes = [];

    // POSITIVE ADJUSTMENTS: Boost when key players are out
    injuredPlayers.forEach(injuredPlayer => {
      if (injuredPlayer.impact.tier !== 'Bench' && player.playerName !== injuredPlayer.playerName) {
        let boost = 0;

        switch (injuredPlayer.impact.tier) {
          case 'Superstar':
            boost = INJURY_BOOST_MULTIPLIERS.SUPERSTAR_OUT;
            break;
          case 'Star':
            boost = INJURY_BOOST_MULTIPLIERS.STAR_OUT;
            break;
          case 'Key Role':
            boost = INJURY_BOOST_MULTIPLIERS.KEY_ROLE_OUT;
            break;
        }

        if ((player.points || 0) >= 15 && (player.usage || 0) >= 18) {
          boost *= 1.2;
        }

        adjustment += boost;
        adjustmentNotes.push(`+${Math.round(boost * 100)}% (${injuredPlayer.playerName} out)`);
      }
    });

    // NEGATIVE ADJUSTMENTS: Reduce when elevated players face returning competition
    returningPlayers.forEach(returningPlayer => {
      if (player.playerName !== returningPlayer.playerName && player.roleAnalysis?.isElevated) {
        const returnImpact = calculateReturnImpact(returningPlayer, player, player.roleAnalysis);

        if (returnImpact.adjustment < 0) {
          adjustment += returnImpact.adjustment;
          adjustmentNotes.push(`${Math.round(returnImpact.adjustment * 100)}% (${returningPlayer.playerName} returns)`);
        }
      }
    });

    // Apply adjustments to stats
    if (adjustment !== 0) {
      const adjustedPlayer = { ...player };

      adjustedPlayer.points = (player.points || 0) * (1 + adjustment);
      adjustedPlayer.assists = (player.assists || 0) * (1 + adjustment);
      adjustedPlayer.rebounds = (player.rebounds || 0) * (1 + adjustment * 0.5);
      adjustedPlayer.usage = (player.usage || 0) * (1 + adjustment * 0.8);

      adjustedPlayer.injuryAdjusted = adjustmentNotes.join(', ');

      return adjustedPlayer;
    }

    return player;
  });
}

/**
 * Apply smart injury impact adjustments
 */
export function applyInjuryImpact(players, injuries, teamStats) {
  if (!players || !Array.isArray(players)) {
    return [];
  }

  if (!injuries || injuries.length === 0) {
    return players.map(player => ({
      ...player,
      impact: calculatePlayerImpact(player)
    }));
  }

  // Determine if we have enough games for sophisticated analysis
  const gamesPlayed = teamStats?.gamesPlayed || 4; // Default to early season
  const useAdvancedAnalysis = gamesPlayed >= 10;

  // Calculate impact scores for all players
  const playersWithImpact = players.map(player => ({
    ...player,
    impact: calculatePlayerImpact(player)
  }));

  if (useAdvancedAnalysis) {
    // Use research-based role elevation analysis (10+ games)
    return applyAdvancedInjuryImpact(playersWithImpact, injuries, teamStats);
  } else {
    // Use simple early-season logic (< 10 games)
    return applyEarlySeasonInjuryImpact(playersWithImpact, injuries, teamStats);
  }
}
