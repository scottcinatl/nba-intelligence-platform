/**
 * NBA Teams Worker - Fetches team statistics and metrics
 * Endpoint: /teams?id=TEAMID&season=2025-26&lastN=5
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
      const teamId = url.searchParams.get('id');
      const season = url.searchParams.get('season') || getCurrentSeason();
      const lastN = url.searchParams.get('lastN') || '0'; // 0 = full season

      if (!teamId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Team ID is required. Use ?id=TEAMID'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      console.log(`Fetching stats for team ${teamId}, season ${season}, lastN=${lastN}`);

      // Fetch team stats
      const [generalStats, advancedStats, opponentStats] = await Promise.all([
        fetchTeamGeneralStats(teamId, season, lastN),
        fetchTeamAdvancedStats(teamId, season, lastN),
        fetchTeamOpponentStats(teamId, season, lastN)
      ]);

      const teamStats = {
        teamId,
        season,
        lastNGames: lastN === '0' ? 'Full Season' : lastN,
        general: generalStats,
        advanced: advancedStats,
        opponent: opponentStats
      };

      return new Response(JSON.stringify({
        success: true,
        data: teamStats
      }, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error fetching team stats:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * Fetch general team statistics
 */
async function fetchTeamGeneralStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=Base` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N` +
    `&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&StarterBench=&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  
  if (!response.ok) {
    throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseTeamStats(data);
}

/**
 * Fetch advanced team statistics (OffRtg, DefRtg, Pace, etc.)
 */
async function fetchTeamAdvancedStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=Advanced` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N` +
    `&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&StarterBench=&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  
  if (!response.ok) {
    throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseAdvancedStats(data);
}

/**
 * Fetch opponent statistics (points allowed, etc.)
 */
async function fetchTeamOpponentStats(teamId, season, lastN) {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=Opponent` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N` +
    `&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&StarterBench=&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  
  if (!response.ok) {
    throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseOpponentStats(data);
}

/**
 * Parse general team stats from NBA API response
 */
function parseTeamStats(data) {
  const headers = data.resultSets[0].headers;
  const row = data.resultSets[0].rowSet[0];
  
  if (!row) return null;

  return {
    teamName: row[headers.indexOf('TEAM_NAME')],
    gamesPlayed: row[headers.indexOf('GP')],
    wins: row[headers.indexOf('W')],
    losses: row[headers.indexOf('L')],
    winPct: row[headers.indexOf('W_PCT')],
    points: row[headers.indexOf('PTS')],
    fieldGoalPct: row[headers.indexOf('FG_PCT')],
    threePointPct: row[headers.indexOf('FG3_PCT')],
    freeThrowPct: row[headers.indexOf('FT_PCT')],
    rebounds: row[headers.indexOf('REB')],
    offensiveRebounds: row[headers.indexOf('OREB')],
    defensiveRebounds: row[headers.indexOf('DREB')],
    assists: row[headers.indexOf('AST')],
    turnovers: row[headers.indexOf('TOV')],
    steals: row[headers.indexOf('STL')],
    blocks: row[headers.indexOf('BLK')],
    personalFouls: row[headers.indexOf('PF')],
    plusMinus: row[headers.indexOf('PLUS_MINUS')]
  };
}

/**
 * Parse advanced stats
 */
function parseAdvancedStats(data) {
  const headers = data.resultSets[0].headers;
  const row = data.resultSets[0].rowSet[0];
  
  if (!row) return null;

  return {
    offensiveRating: row[headers.indexOf('OFF_RATING')],
    defensiveRating: row[headers.indexOf('DEF_RATING')],
    netRating: row[headers.indexOf('NET_RATING')],
    pace: row[headers.indexOf('PACE')],
    effectiveFGPct: row[headers.indexOf('EFG_PCT')],
    trueShootingPct: row[headers.indexOf('TS_PCT')],
    assistRatio: row[headers.indexOf('AST_RATIO')],
    reboundPct: row[headers.indexOf('REB_PCT')],
    offensiveReboundPct: row[headers.indexOf('OREB_PCT')],
    defensiveReboundPct: row[headers.indexOf('DREB_PCT')],
    turnoverRatio: row[headers.indexOf('TM_TOV_PCT')]
  };
}

/**
 * Parse opponent stats
 */
function parseOpponentStats(data) {
  const headers = data.resultSets[0].headers;
  const row = data.resultSets[0].rowSet[0];
  
  if (!row) return null;

  return {
    pointsAllowed: row[headers.indexOf('PTS')],
    fieldGoalPctAllowed: row[headers.indexOf('FG_PCT')],
    threePointPctAllowed: row[headers.indexOf('FG3_PCT')],
    reboundsAllowed: row[headers.indexOf('REB')],
    assistsAllowed: row[headers.indexOf('AST')],
    turnoversForced: row[headers.indexOf('TOV')],
    steals: row[headers.indexOf('STL')],
    blocks: row[headers.indexOf('BLK')]
  };
}

/**
 * Get NBA.com API headers
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
  const month = now.getMonth() + 1; // 0-indexed
  
  // NBA season runs Oct-Jun, so if we're in Oct-Dec use current year, else use previous year
  if (month >= 10) {
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}