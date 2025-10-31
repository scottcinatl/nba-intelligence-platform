/**
 * NBA Team Style Profile Worker - Analyzes team's systematic tendencies and style of play
 * Endpoint: /profile?team=TEAMID&season=2024-25&lastN=10
 * 
 * Returns comprehensive team "DNA":
 * - Offensive style (pace, shot selection, ball movement)
 * - Defensive style (pressure, help defense, fouling)
 * - Situational tendencies (clutch, blowouts, home/away)
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const teamId = url.searchParams.get('team');
      const season = url.searchParams.get('season') || getCurrentSeason();
      const lastN = url.searchParams.get('lastN') || '0';

      if (!teamId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Team ID is required. Use ?team=TEAMID',
          example: '/profile?team=1610612738&season=2024-25&lastN=10',
          commonTeamIds: {
            'Boston Celtics': '1610612738',
            'Los Angeles Lakers': '1610612747',
            'Golden State Warriors': '1610612744',
            'Philadelphia 76ers': '1610612755',
            'Miami Heat': '1610612748'
          }
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      console.log(`Fetching team style profile: team=${teamId}, season=${season}, lastN=${lastN}`);

      const styleProfile = await buildTeamStyleProfile(teamId, season, lastN);

      return new Response(JSON.stringify({
        success: true,
        profile: styleProfile,
        metadata: {
          teamId,
          season,
          lastNGames: lastN === '0' ? 'Full Season' : lastN,
          dataSource: 'NBA_ADVANCED_STATS',
          timestamp: new Date().toISOString(),
          categories: ['offensive', 'defensive', 'situational', 'advanced']
        }
      }, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error fetching team style profile:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        details: {
          possibleCauses: [
            'NBA API rate limiting',
            'Invalid team ID',
            'Network connectivity issues',
            'NBA API maintenance'
          ]
        }
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * Build comprehensive team style profile from multiple NBA API endpoints
 */
async function buildTeamStyleProfile(teamId, season, lastN) {
  // Fetch data from multiple endpoints in parallel
  const [
    baseStats,
    advancedStats,
    shootingStats,
    opponentStats
  ] = await Promise.all([
    fetchTeamBaseStats(teamId, season, lastN),
    fetchTeamAdvancedStats(teamId, season, lastN), 
    fetchTeamShootingStats(teamId, season, lastN),
    fetchTeamOpponentStats(teamId, season, lastN)
  ]);

  // Build comprehensive style profile
  return {
    // Basic team info
    teamId,
    season,
    lastNGames: lastN,
    
    // OFFENSIVE STYLE PROFILE
    offensiveStyle: {
      // Pace and tempo - no defaults, show null if unavailable
      pace: baseStats.PACE,
      offensiveRating: baseStats.OFF_RATING,
      possessionsPerGame: baseStats.POSS,
      
      // Shot selection DNA
      shotSelection: {
        fieldGoalsPerGame: baseStats.FGA,
        threePointRate: calculateRate(baseStats.FG3A, baseStats.FGA), // % of shots from 3
        twoPointRate: calculateRate(baseStats.FGA - baseStats.FG3A, baseStats.FGA),
        freeThrowRate: calculateRate(baseStats.FTA, baseStats.FGA), // FT attempts per FG attempt
        
        // Shot location preferences (from shooting stats)
        restrictedAreaFreq: shootingStats.RESTRICTED_AREA_FGA_FREQ,
        paintFreq: shootingStats.PAINT_TOUCH_FGA_FREQ,
        midRangeFreq: shootingStats.MID_RANGE_FGA_FREQ,
        corner3Freq: shootingStats.CORNER_3_FGA_FREQ,
        aboveBreak3Freq: shootingStats.ABOVE_BREAK_3_FGA_FREQ
      },
      
      // Ball movement and style
      ballMovement: {
        assistRate: calculateRate(baseStats.AST, baseStats.FGM), // % of made FGs assisted
        assistToTurnoverRatio: calculateRate(baseStats.AST, baseStats.TOV),
        passesPerGame: advancedStats.PASSES_MADE,
        secondaryAssists: advancedStats.SECONDARY_ASSISTS,
        potentialAssists: advancedStats.POTENTIAL_ASSISTS
      },
      
      // Efficiency metrics  
      efficiency: {
        fieldGoalPct: baseStats.FG_PCT,
        threePointPct: baseStats.FG3_PCT,
        freeThrowPct: baseStats.FT_PCT,
        trueShootingPct: advancedStats.TS_PCT,
        effectiveFieldGoalPct: advancedStats.EFG_PCT
      },
      
      // Rebounding approach
      rebounding: {
        offensiveReboundRate: calculateRate(baseStats.OREB, baseStats.OREB + opponentStats.DREB),
        offensiveReboundsPerGame: baseStats.OREB,
        secondChancePoints: advancedStats.SECOND_CHANCE_PTS
      },
      
      // Turnover tendencies
      ballSecurity: {
        turnoverRate: calculateRate(baseStats.TOV, baseStats.POSS), // TO per possession
        turnoversPerGame: baseStats.TOV,
        liveballTurnovers: advancedStats.LIVE_BALL_TOV
      }
    },
    
    // DEFENSIVE STYLE PROFILE  
    defensiveStyle: {
      // Overall defensive impact
      defensiveRating: baseStats.DEF_RATING,
      opponentFieldGoalPct: opponentStats.OPP_FG_PCT,
      opponentThreePointPct: opponentStats.OPP_FG3_PCT,
      
      // Pressure and disruption
      pressure: {
        stealRate: calculateRate(baseStats.STL, opponentStats.POSS), // Steals per opponent possession
        stealsPerGame: baseStats.STL,
        deflections: advancedStats.DEFLECTIONS,
        looseBallsRecovered: advancedStats.LOOSE_BALLS_RECOVERED
      },
      
      // Interior defense
      interiorDefense: {
        blockRate: calculateRate(baseStats.BLK, opponentStats.FGA), // Blocks per opponent FGA
        blocksPerGame: baseStats.BLK,
        opponentPaintPoints: opponentStats.OPP_PAINT_PTS,
        rimProtection: advancedStats.CONTESTED_SHOTS_2PT
      },
      
      // Fouling tendencies
      fouling: {
        foulRate: calculateRate(baseStats.PF, opponentStats.POSS), // Fouls per opponent possession
        personalFoulsPerGame: baseStats.PF,
        opponentFreeThrowRate: calculateRate(opponentStats.FTA, opponentStats.FGA)
      },
      
      // Rebounding defense
      defensiveRebounding: {
        defensiveReboundRate: calculateRate(baseStats.DREB, baseStats.DREB + opponentStats.OREB),
        defensiveReboundsPerGame: baseStats.DREB,
        opponentSecondChancePoints: opponentStats.OPP_SECOND_CHANCE_PTS
      },
      
      // Forcing turnovers
      disruption: {
        forcesTurnoverRate: calculateRate(opponentStats.OPP_TOV, opponentStats.POSS),
        opponentTurnoversForced: opponentStats.OPP_TOV,
        pointsOffTurnovers: baseStats.PTS_OFF_TOV
      }
    },
    
    // SITUATIONAL TENDENCIES
    situationalTendencies: {
      // Home vs Away splits (would need additional endpoint calls)
      homeAdvantage: {
        homeOffensiveRating: null, // Would fetch from splits
        homeDefensiveRating: null,
        homePace: null,
        estimatedHomeBoost: 1.02 // Historical average
      },
      
      // Game situation behavior
      gameFlow: {
        averageLeadChanges: advancedStats.LEAD_CHANGES,
        timesTied: advancedStats.TIMES_TIED,
        largestLead: advancedStats.LARGEST_LEAD,
        fastBreakPointsPerGame: baseStats.FAST_BREAK_PTS,
        pointsInPaintPerGame: baseStats.PAINT_PTS
      },
      
      // Clutch time performance (last 5 minutes, score within 5)
      clutchTime: {
        clutchOffensiveRating: null, // Would need clutch endpoint
        clutchDefensiveRating: null,
        clutchPace: null,
        estimatedClutchPaceFactor: 0.92 // Teams typically slow down
      }
    },
    
    // ADVANCED ANALYTICS
    advanced: {
      // Four factors (Dean Oliver's basketball analytics)
      fourFactors: {
        offensiveRating: baseStats.OFF_RATING,
        defensiveRating: baseStats.DEF_RATING,
        netRating: baseStats.OFF_RATING && baseStats.DEF_RATING ? baseStats.OFF_RATING - baseStats.DEF_RATING : null,
        pace: baseStats.PACE
      },
      
      // Team chemistry indicators
      teamChemistry: {
        assistPercentage: calculateRate(baseStats.AST, baseStats.FGM),
        ballMovementRating: (advancedStats.PASSES_MADE && baseStats.POSS) ? advancedStats.PASSES_MADE / baseStats.POSS : null,
        unassistedFieldGoals: (baseStats.FGM && baseStats.AST) ? baseStats.FGM - baseStats.AST : null
      },
      
      // Consistency metrics
      consistency: {
        pointsVariance: null, // Would calculate from game logs
        pacingConsistency: null,
        shotSelectionConsistency: null
      }
    },
    
    // CALCULATED TEAM DNA SUMMARY
    teamDNA: {
      primaryStyle: determinePlayStyle(baseStats, advancedStats),
      pace: baseStats.PACE ? categorizePace(baseStats.PACE) : 'Unknown',
      offense: categorizeOffense(baseStats, shootingStats),
      defense: categorizeDefense(baseStats, opponentStats),
      keyStrengths: identifyKeyStrengths(baseStats, advancedStats, shootingStats),
      keyWeaknesses: identifyKeyWeaknesses(baseStats, opponentStats)
    }
  };
}

/**
 * Fetch team base stats (pace, offensive/defensive rating, etc.)
 */
async function fetchTeamBaseStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=Base` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N` +
    `&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=` +
    `&SeasonType=Regular+Season&ShotClockRange=&StarterBench=` +
    `&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  if (!response.ok) {
    throw new Error(`NBA API base stats error: ${response.status}`);
  }

  const data = await response.json();
  return parseTeamStatsRow(data);
}

/**
 * Fetch team advanced stats (true shooting, effective FG%, etc.)
 */
async function fetchTeamAdvancedStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=Advanced` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N` +
    `&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=` +
    `&SeasonType=Regular+Season&ShotClockRange=&StarterBench=` +
    `&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  if (!response.ok) {
    throw new Error(`NBA API advanced stats error: ${response.status}`);
  }

  const data = await response.json();
  return parseTeamStatsRow(data);
}

/**
 * Fetch team shooting stats (shot location, frequency, etc.)
 */
async function fetchTeamShootingStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/teamdashboardbyshootingsplits?` +
    `DateFrom=&DateTo=&GameSegment=&LastNGames=${lastN}&LeagueID=00` +
    `&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=` +
    `&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N` +
    `&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  if (!response.ok) {
    throw new Error(`NBA API shooting stats error: ${response.status}`);
  }

  const data = await response.json();
  return parseTeamStatsRow(data);
}

/**
 * Fetch opponent stats (what teams allow defensively)
 */
async function fetchTeamOpponentStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/teamdashboardbyopponent?` +
    `DateFrom=&DateTo=&GameSegment=&LastNGames=${lastN}&LeagueID=00` +
    `&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=` +
    `&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N` +
    `&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  if (!response.ok) {
    throw new Error(`NBA API opponent stats error: ${response.status}`);
  }

  const data = await response.json();
  return parseTeamStatsRow(data);
}

/**
 * Parse team stats row from NBA API response
 */
function parseTeamStatsRow(data) {
  if (!data.resultSets || data.resultSets.length === 0) {
    return {};
  }

  const resultSet = data.resultSets[0];
  const headers = resultSet.headers;
  const rows = resultSet.rowSet;

  if (!rows || rows.length === 0) {
    return {};
  }

  const row = rows[0]; // First (and usually only) team row
  const stats = {};

  headers.forEach((header, index) => {
    stats[header] = row[index];
  });

  return stats;
}

/**
 * Helper function to calculate rates safely
 */
function calculateRate(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Determine primary play style based on stats
 */
function determinePlayStyle(baseStats, advancedStats) {
  const pace = baseStats.PACE;
  const threePointRate = calculateRate(baseStats.FG3A, baseStats.FGA);
  const assistRate = calculateRate(baseStats.AST, baseStats.FGM);

  // If we don't have pace data, categorize based on other metrics
  if (!pace) {
    if (threePointRate > 0.45) {
      return 'Three-Point Specialist';
    } else if (assistRate > 0.65) {
      return 'Ball Movement System';
    } else if (baseStats.PAINT_PTS && baseStats.PAINT_PTS > 48) {
      return 'Paint Dominant';
    } else {
      return 'Balanced Approach';
    }
  }

  // Full categorization with pace data
  if (pace > 102 && threePointRate > 0.40) {
    return 'Fast & Three-Heavy';
  } else if (pace > 102) {
    return 'Fast Break Oriented';
  } else if (threePointRate > 0.45) {
    return 'Three-Point Specialist';
  } else if (assistRate > 0.65) {
    return 'Ball Movement System';
  } else if (baseStats.PAINT_PTS && baseStats.PAINT_PTS > 48) {
    return 'Paint Dominant';
  } else {
    return 'Balanced Approach';
  }
}

/**
 * Categorize team pace
 */
function categorizePace(pace) {
  if (pace > 103) return 'Fast';
  if (pace > 100) return 'Above Average';
  if (pace > 98) return 'Average';
  return 'Slow';
}

/**
 * Categorize offensive style
 */
function categorizeOffense(baseStats, shootingStats) {
  const threePointRate = calculateRate(baseStats.FG3A, baseStats.FGA);
  const paintPts = baseStats.PAINT_PTS;

  if (threePointRate > 0.42 && paintPts < 45) {
    return 'Perimeter Focused';
  } else if (paintPts > 50) {
    return 'Interior Focused';
  } else {
    return 'Balanced Attack';
  }
}

/**
 * Categorize defensive style
 */
function categorizeDefense(baseStats, opponentStats) {
  const stealRate = calculateRate(baseStats.STL, opponentStats.POSS);
  const blockRate = calculateRate(baseStats.BLK, opponentStats.FGA);

  if (stealRate > 0.09) {
    return 'Pressure Defense';
  } else if (blockRate > 0.06) {
    return 'Rim Protection';
  } else {
    return 'Disciplined Defense';
  }
}

/**
 * Identify key team strengths
 */
function identifyKeyStrengths(baseStats, advancedStats, shootingStats) {
  const strengths = [];
  
  if (baseStats.PACE && baseStats.PACE > 103) strengths.push('Fast Pace');
  if (baseStats.OFF_RATING && baseStats.OFF_RATING > 115) strengths.push('High-Powered Offense');
  if (baseStats.DEF_RATING && baseStats.DEF_RATING < 108) strengths.push('Elite Defense');
  if (calculateRate(baseStats.FG3A, baseStats.FGA) > 0.42) strengths.push('Three-Point Shooting');
  if (calculateRate(baseStats.AST, baseStats.FGM) > 0.65) strengths.push('Ball Movement');
  if (baseStats.PAINT_PTS && baseStats.PAINT_PTS > 50) strengths.push('Interior Scoring');
  
  return strengths;
}

/**
 * Identify key team weaknesses
 */
function identifyKeyWeaknesses(baseStats, opponentStats) {
  const weaknesses = [];
  
  if (baseStats.TOV && baseStats.TOV > 16) weaknesses.push('Ball Security');
  if (baseStats.FT_PCT && baseStats.FT_PCT < 0.72) weaknesses.push('Free Throw Shooting');
  if (calculateRate(baseStats.OREB, baseStats.OREB + opponentStats.DREB) < 0.25) weaknesses.push('Offensive Rebounding');
  if (baseStats.DEF_RATING && baseStats.DEF_RATING > 115) weaknesses.push('Defensive Efficiency');
  if (opponentStats.OPP_FG3_PCT && opponentStats.OPP_FG3_PCT > 0.37) weaknesses.push('Three-Point Defense');
  
  return weaknesses;
}

/**
 * Get NBA.com API headers - same as other workers
 */
function getNBAHeaders() {
  return {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.nba.com/',
      'Origin': 'https://www.nba.com',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    cf: {
      cacheTtl: 300, // Cache for 5 minutes
      cacheEverything: true
    }
  };
}

/**
 * Get current NBA season string
 */
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month >= 10) {
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}