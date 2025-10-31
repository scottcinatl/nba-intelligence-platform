/**
 * NBA Lineups Worker - Fetches team lineup statistics
 * Endpoint: /lineups?team=TEAMID&season=2024-25&lastN=10
 * 
 * Based on the working patterns from the NBA Players Worker
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
      const measureType = url.searchParams.get('measureType') || 'Base';

      if (!teamId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Team ID is required. Use ?team=TEAMID',
          example: '/lineups?team=1610612738&season=2024-25&lastN=10',
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

      console.log(`Fetching lineup stats: team=${teamId}, season=${season}, lastN=${lastN}`);

      const lineups = await fetchTeamLineups(teamId, season, lastN, measureType);

      return new Response(JSON.stringify({
        success: true,
        lineups: lineups,
        metadata: {
          teamId,
          season,
          lastNGames: lastN === '0' ? 'Full Season' : lastN,
          measureType,
          totalLineups: lineups.length,
          dataSource: 'NBA_TEAMDASHLINEUPS',
          timestamp: new Date().toISOString()
        }
      }, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error fetching lineup stats:', error);
      
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
 * Fetch team lineup combinations using the same pattern as player worker
 */
async function fetchTeamLineups(teamId, season, lastN, measureType) {
  const url = `https://stats.nba.com/stats/teamdashlineups?` +
    `DateFrom=&DateTo=&GameID=&GameSegment=&GroupQuantity=5` +
    `&LastNGames=${lastN}&LeagueID=00&Location=&MeasureType=${measureType}` +
    `&Month=0&OpponentTeamID=0&Outcome=&PORound=&PaceAdjust=N` +
    `&PerMode=Totals&Period=0&PlusMinus=N&Rank=N&Season=${season}` +
    `&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=` +
    `&TeamID=${teamId}&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  
  if (!response.ok) {
    throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseLineupData(data);
}

/**
 * Parse lineup data from NBA API response
 */
function parseLineupData(data) {
  if (!data.resultSets || data.resultSets.length === 0) {
    console.log('No result sets in NBA data');
    return [];
  }

  // Find the Lineups result set
  const lineupResultSet = data.resultSets.find(rs => rs.name === 'Lineups') || data.resultSets[0];
  
  if (!lineupResultSet || !lineupResultSet.rowSet) {
    console.log('No lineup result set or row data found');
    return [];
  }

  const headers = lineupResultSet.headers;
  const rows = lineupResultSet.rowSet;

  console.log(`Processing ${rows.length} lineup rows with ${headers.length} columns`);

  const lineups = rows.map(row => {
    const lineup = {};
    
    // Map each column to its header
    headers.forEach((header, index) => {
      lineup[header] = row[index];
    });

    // Extract and structure the important data
    return {
      groupId: lineup.GROUP_ID,
      groupName: lineup.GROUP_NAME,
      players: parsePlayersFromGroupName(lineup.GROUP_NAME),
      
      // Game stats
      gamesPlayed: lineup.GP || 0,
      wins: lineup.W || 0,
      losses: lineup.L || 0,
      winPercentage: lineup.W_PCT || 0,
      minutesTogether: lineup.MIN || 0,
      
      // Advanced stats
      plusMinus: lineup.PLUS_MINUS || 0,
      
      // Shooting stats
      fieldGoalsMade: lineup.FGM || 0,
      fieldGoalsAttempted: lineup.FGA || 0,
      fieldGoalPercentage: lineup.FG_PCT || 0,
      threePointersMade: lineup.FG3M || 0,
      threePointersAttempted: lineup.FG3A || 0,
      threePointPercentage: lineup.FG3_PCT || 0,
      freeThrowsMade: lineup.FTM || 0,
      freeThrowsAttempted: lineup.FTA || 0,
      freeThrowPercentage: lineup.FT_PCT || 0,
      
      // Other stats
      offensiveRebounds: lineup.OREB || 0,
      defensiveRebounds: lineup.DREB || 0,
      totalRebounds: lineup.REB || 0,
      assists: lineup.AST || 0,
      turnovers: lineup.TOV || 0,
      steals: lineup.STL || 0,
      blocks: lineup.BLK || 0,
      personalFouls: lineup.PF || 0,
      points: lineup.PTS || 0,
      
      // Calculated rates
      assistRate: calculateRate(lineup.AST, lineup.FGM),
      turnoverRate: calculateRate(lineup.TOV, lineup.FGA + (lineup.FTA * 0.44) + lineup.TOV),
      pace: calculatePace(lineup.MIN, lineup.FGA, lineup.FTA, lineup.TOV, lineup.OREB, lineup.DREB),
      
      // Rankings (useful for identifying best/worst lineups)
      minutesRank: lineup.MIN_RANK || null,
      plusMinusRank: lineup.PLUS_MINUS_RANK || null,
      pointsRank: lineup.PTS_RANK || null
    };
  });

  // Sort by minutes played (most used lineups first)
  lineups.sort((a, b) => b.minutesTogether - a.minutesTogether);

  console.log(`Processed ${lineups.length} lineups, top lineup: ${lineups[0]?.minutesTogether || 0} minutes`);

  return lineups;
}

/**
 * Parse player names from GROUP_NAME field
 */
function parsePlayersFromGroupName(groupName) {
  if (!groupName) return [];
  
  // GROUP_NAME format is typically: "Player A - Player B - Player C - Player D - Player E"
  return groupName.split(' - ').map(name => name.trim()).filter(name => name.length > 0);
}

/**
 * Calculate rate statistics
 */
function calculateRate(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate pace for lineup
 */
function calculatePace(minutes, fga, fta, tov, oreb, dreb) {
  // Simplified pace calculation
  if (!minutes || minutes === 0) return 0;
  
  const possessions = fga + (fta * 0.44) + tov - oreb;
  return (possessions / minutes) * 48; // 48 minutes in a game
}

/**
 * Get NBA.com API headers - EXACT SAME AS PLAYER WORKER
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
 * Get current NBA season string - EXACT SAME AS PLAYER WORKER
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