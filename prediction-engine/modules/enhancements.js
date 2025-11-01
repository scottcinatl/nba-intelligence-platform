/**
 * Enhancements Module
 * Handles all player enhancement calculations including team style fit and multiplicative stacking
 */

import { ENHANCEMENT_WEIGHTS } from '../config/constants.js';

/**
 * Apply team style and matchup-based enhancements to player projections
 * Uses multiplicative system with 20% cap to prevent unrealistic projections
 */
export function applyPlayerEnhancements(player, context, playerIndex) {
  // NEW: Use multiplicative enhancements with cap instead of additive
  let enhancementMultipliers = [];
  let reasons = [];

  const { teamStyle, lineups, opponentStyle, opponentLineups, isHome } = context;

  // ENHANCEMENT 1: Team Style Multipliers
  if (teamStyle.success && teamStyle.profile && opponentStyle.success && opponentStyle.profile) {
    const myStyle = teamStyle.profile;
    const oppStyle = opponentStyle.profile;

    // Pace advantage boost (when data available)
    if (myStyle.offensiveStyle?.pace && oppStyle.offensiveStyle?.pace) {
      const paceAdvantage = myStyle.offensiveStyle.pace - oppStyle.offensiveStyle.pace;
      if (paceAdvantage > ENHANCEMENT_WEIGHTS.PACE_ADVANTAGE_THRESHOLD) {
        // Fast pace benefits guards and ball handlers more
        if (playerIndex <= 2) { // Top 3 players typically guards/wings
          enhancementMultipliers.push({
            type: 'pace',
            points: 1.03, // +3% points
            assists: 1.05 // +5% assists
          });
          reasons.push('pace advantage');
        }
      }
    }

    // Three-point shooting advantage
    if (myStyle.offensiveStyle?.shotSelection && oppStyle.defensiveStyle) {
      const myThreeRate = myStyle.offensiveStyle.shotSelection.threePointRate;
      const oppThreeDefense = oppStyle.defensiveStyle.opponentThreePointPct || 0.36;

      // If team shoots lots of threes AND opponent allows high 3P%
      if (myThreeRate > ENHANCEMENT_WEIGHTS.THREE_POINT_RATE_THRESHOLD &&
          oppThreeDefense > ENHANCEMENT_WEIGHTS.THREE_POINT_DEFENSE_THRESHOLD) {
        // Boost three-point shooters
        if (player.threePointersMade > 1.5) {
          enhancementMultipliers.push({
            type: '3PT',
            points: 1.06, // +6% points
            threePointers: 1.08 // +8% three-pointers
          });
          reasons.push('3PT advantage');
        }
      }
    }

    // Ball movement advantage
    if (myStyle.offensiveStyle?.ballMovement && oppStyle.defensiveStyle) {
      const myAssistRate = myStyle.offensiveStyle.ballMovement.assistRate;
      if (myAssistRate > ENHANCEMENT_WEIGHTS.BALL_MOVEMENT_THRESHOLD) {
        // Boost primary playmakers in ball movement systems
        if (playerIndex <= 1 && player.assists > 3) {
          enhancementMultipliers.push({
            type: 'ballMovement',
            assists: 1.10, // +10% assists
            points: 1.02 // +2% points
          });
          reasons.push('ball movement system');
        }
      }
    }

    // NEW: Paint frequency advantage
    if (myStyle.offensiveStyle?.shotSelection && oppStyle.defensiveStyle) {
      const myPaintFreq = myStyle.offensiveStyle.shotSelection.paintTouches || 0;
      const oppPaintDef = oppStyle.defensiveStyle.pointsInPaintAgainst || 40;

      // Paint-heavy team vs weak paint defense
      if (myPaintFreq > ENHANCEMENT_WEIGHTS.PAINT_FREQUENCY_THRESHOLD &&
          oppPaintDef > ENHANCEMENT_WEIGHTS.PAINT_DEFENSE_THRESHOLD) {
        // Boost interior players
        if (player.position === 'C' || player.position === 'PF') {
          enhancementMultipliers.push({
            type: 'paintAdvantage',
            points: 1.06, // +6% points
            rebounds: 1.04 // +4% rebounds
          });
          reasons.push('paint mismatch');
        }
      }
    }

    // NEW: Transition frequency advantage
    if (myStyle.offensiveStyle?.transitionFrequency && oppStyle.defensiveStyle?.transitionDefense) {
      const myTransition = myStyle.offensiveStyle.transitionFrequency;
      const oppTransitionDef = oppStyle.defensiveStyle.transitionDefense;

      // High transition team vs weak transition defense
      if (myTransition > ENHANCEMENT_WEIGHTS.TRANSITION_FREQUENCY_THRESHOLD &&
          oppTransitionDef > ENHANCEMENT_WEIGHTS.TRANSITION_DEFENSE_THRESHOLD) {
        // Boost athletic wings and guards
        if (playerIndex <= 3 && (player.position === 'PG' || player.position === 'SG' || player.position === 'SF')) {
          enhancementMultipliers.push({
            type: 'transition',
            points: 1.04, // +4% points
            assists: 1.03 // +3% assists
          });
          reasons.push('transition edge');
        }
      }
    }
  }

  // ENHANCEMENT 2: Lineup Efficiency Bonuses
  if (lineups.success && lineups.rotationIntelligence) {
    const rotation = lineups.rotationIntelligence;

    // Starting lineup efficiency boost
    if (rotation.startingLineup && rotation.startingLineup.plusMinus > 15) {
      // Top 5 players likely in starting lineup
      if (playerIndex < 5) {
        enhancementMultipliers.push({
          type: 'dominantLineup',
          points: 1.03, // +3% points
          assists: 1.02, // +2% assists
          rebounds: 1.03 // +3% rebounds
        });
        reasons.push('dominant lineup');
      }
    }

    // High-confidence rotation boost
    if (rotation.confidence > 0.90) {
      // Players with defined roles get consistency boost
      if (playerIndex < 7) {
        enhancementMultipliers.push({
          type: 'stableRotation',
          points: 1.02 // +2% points
        });
        reasons.push('stable rotation');
      }
    }
  }

  // ENHANCEMENT 3: Matchup-Specific Adjustments

  // Home court advantage (slight boost for role players)
  if (isHome && playerIndex > 2) {
    enhancementMultipliers.push({
      type: 'homeCourt',
      points: 1.02, // +2% points
      rebounds: 1.02 // +2% rebounds
    });
    reasons.push('home court');
  }

  // Star player advantages in favorable matchups
  const impact = player.impact?.tier;
  if ((impact === 'Superstar' || impact === 'Star') && reasons.length > 0) {
    // Stars benefit more from team advantages
    enhancementMultipliers.push({
      type: 'starMultiplier',
      points: 1.04, // +4% points
      assists: 1.05 // +5% assists
    });
    reasons.push('star multiplier');
  }

  // NEW: Calculate final multipliers with 20% cap
  const finalMultipliers = calculateCappedMultipliers(enhancementMultipliers);

  return {
    pointsMultiplier: finalMultipliers.points,
    assistsMultiplier: finalMultipliers.assists,
    reboundsMultiplier: finalMultipliers.rebounds,
    threePoinersMultiplier: finalMultipliers.threePointers,
    totalEnhancement: (finalMultipliers.points - 1) * 100, // Convert to percentage
    reasons,
    rawMultipliers: enhancementMultipliers.length
  };
}

/**
 * NEW: Calculate capped multipliers to prevent unrealistic projections
 * Maximum 20% total boost from all enhancements combined
 */
export function calculateCappedMultipliers(multipliers) {
  const result = {
    points: 1.0,
    assists: 1.0,
    rebounds: 1.0,
    threePointers: 1.0
  };

  // Compound all multipliers
  multipliers.forEach(m => {
    if (m.points) result.points *= m.points;
    if (m.assists) result.assists *= m.assists;
    if (m.rebounds) result.rebounds *= m.rebounds;
    if (m.threePointers) result.threePointers *= m.threePointers;
  });

  // Apply 20% cap (1.20 max multiplier)
  result.points = Math.min(result.points, ENHANCEMENT_WEIGHTS.MAX_MULTIPLIER);
  result.assists = Math.min(result.assists, ENHANCEMENT_WEIGHTS.MAX_MULTIPLIER);
  result.rebounds = Math.min(result.rebounds, ENHANCEMENT_WEIGHTS.MAX_MULTIPLIER);
  result.threePointers = Math.min(result.threePointers, ENHANCEMENT_WEIGHTS.MAX_MULTIPLIER);

  return result;
}
