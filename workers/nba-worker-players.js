/**
 * NBA Players Worker - Enhanced with Position Data
 * Fetches player statistics + official NBA positions
 * Endpoint: /players?team=TEAMID&season=2025-26&lastN=5
 * Or: /players?id=PLAYERID&season=2025-26&lastN=5
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
      const playerId = url.searchParams.get('id');
      const season = url.searchParams.get('season') || getCurrentSeason();
      const lastN = url.searchParams.get('lastN') || '0';

      if (!teamId && !playerId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Either team ID or player ID is required. Use ?team=TEAMID or ?id=PLAYERID'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      console.log(`Fetching player stats: team=${teamId}, player=${playerId}, season=${season}, lastN=${lastN}`);

      let players;
      if (playerId) {
        // Fetch single player with position
        players = [await fetchPlayerStatsWithPosition(playerId, season, lastN)];
      } else {
        // Fetch all players for team with positions
        players = await fetchTeamPlayersWithPositions(teamId, season, lastN);
      }

      return new Response(JSON.stringify({
        success: true,
        season,
        lastNGames: lastN === '0' ? 'Full Season' : lastN,
        playerCount: players.length,
        players: players,
        dataEnhancements: ['official_positions', 'player_profiles', 'physical_data']
      }, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error fetching player stats:', error);
      
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
 * NEW: Fetch all players for a team with position data
 */
async function fetchTeamPlayersWithPositions(teamId, season, lastN) {
  // Get basic stats first
  const players = await fetchTeamPlayers(teamId, season, lastN);
  
  // Get roster data with positions for the team
  const rosterData = await fetchTeamRoster(teamId, season);
  
  // Merge position data with stats
  return players.map(player => {
    const rosterInfo = rosterData.find(r => r.playerId === player.playerId);
    return {
      ...player,
      // NEW: Official position data
      position: rosterInfo?.position || null,
      height: rosterInfo?.height || null,
      weight: rosterInfo?.weight || null,
      experience: rosterInfo?.experience || null,
      jersey: rosterInfo?.jersey || null,
      birthDate: rosterInfo?.birthDate || null
    };
  });
}

/**
 * NEW: Fetch single player with position data  
 */
async function fetchPlayerStatsWithPosition(playerId, season, lastN) {
  // Get basic stats
  const playerStats = await fetchPlayerStats(playerId, season, lastN);
  if (!playerStats) return null;
  
  // Get player profile with position
  const profileData = await fetchPlayerProfile(playerId);
  
  return {
    ...playerStats,
    // NEW: Official position data
    position: profileData?.position || null,
    height: profileData?.height || null,
    weight: profileData?.weight || null,
    experience: profileData?.experience || null,
    jersey: profileData?.jersey || null,
    birthDate: profileData?.birthDate || null
  };
}

/**
 * NEW: Fetch team roster with positions
 */
async function fetchTeamRoster(teamId, season) {
  const url = `https://stats.nba.com/stats/commonteamroster/?TeamID=${teamId}&Season=${season}`;
  
  try {
    const response = await fetch(url, getNBAHeaders());
    if (!response.ok) {
      console.warn(`Could not fetch roster for team ${teamId}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const headers = data.resultSets[0].headers;
    const rows = data.resultSets[0].rowSet;
    
    return rows.map(row => ({
      playerId: row[headers.indexOf('PLAYER_ID')],
      playerName: row[headers.indexOf('PLAYER')],
      jersey: row[headers.indexOf('NUM')],
      position: row[headers.indexOf('POSITION')],
      height: row[headers.indexOf('HEIGHT')],
      weight: row[headers.indexOf('WEIGHT')],
      birthDate: row[headers.indexOf('BIRTH_DATE')],
      experience: row[headers.indexOf('EXP')]
    }));
  } catch (error) {
    console.warn(`Error fetching roster for team ${teamId}:`, error.message);
    return [];
  }
}

/**
 * NEW: Fetch individual player profile with position
 */
async function fetchPlayerProfile(playerId) {
  const url = `https://stats.nba.com/stats/commonplayerinfo/?PlayerID=${playerId}`;
  
  try {
    const response = await fetch(url, getNBAHeaders());
    if (!response.ok) {
      console.warn(`Could not fetch profile for player ${playerId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const headers = data.resultSets[0].headers;
    const row = data.resultSets[0].rowSet[0];
    
    if (!row) return null;
    
    return {
      playerId: row[headers.indexOf('PERSON_ID')],
      playerName: row[headers.indexOf('DISPLAY_FIRST_LAST')],
      jersey: row[headers.indexOf('JERSEY')],
      position: row[headers.indexOf('POSITION')],
      height: row[headers.indexOf('HEIGHT')],
      weight: row[headers.indexOf('WEIGHT')],
      birthDate: row[headers.indexOf('BIRTHDATE')],
      experience: row[headers.indexOf('SEASON_EXP')]
    };
  } catch (error) {
    console.warn(`Error fetching profile for player ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Fetch all players for a team (existing function, unchanged)
 */
async function fetchTeamPlayers(teamId, season, lastN) {
  // First get general stats
  const generalUrl = `https://stats.nba.com/stats/leaguedashplayerstats?` +
    `College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=` +
    `&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=${lastN}` +
    `&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0` +
    `&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0` +
    `&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}` +
    `&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=` +
    `&StarterBench=&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=&Weight=`;

  const generalResponse = await fetch(generalUrl, getNBAHeaders());
  if (!generalResponse.ok) {
    throw new Error(`NBA API returned ${generalResponse.status}: ${generalResponse.statusText}`);
  }
  const generalData = await generalResponse.json();

  // Then get advanced stats
  const advancedUrl = `https://stats.nba.com/stats/leaguedashplayerstats?` +
    `College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=` +
    `&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=${lastN}` +
    `&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0` +
    `&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0` +
    `&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}` +
    `&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=` +
    `&StarterBench=&TeamID=${teamId}&TwoWay=0&VsConference=&VsDivision=&Weight=`;

  const advancedResponse = await fetch(advancedUrl, getNBAHeaders());
  if (!advancedResponse.ok) {
    throw new Error(`NBA API returned ${advancedResponse.status}: ${advancedResponse.statusText}`);
  }
  const advancedData = await advancedResponse.json();

  // Merge general and advanced stats
  return mergePlayerStats(generalData, advancedData);
}

/**
 * Fetch stats for a single player (existing function, unchanged)
 */
async function fetchPlayerStats(playerId, season, lastN) {
  const url = `https://stats.nba.com/stats/playerdashboardbygeneralsplits?` +
    `DateFrom=&DateTo=&GameSegment=&LastNGames=${lastN}&LeagueID=00` +
    `&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=` +
    `&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=${playerId}` +
    `&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&Split=general&VsConference=&VsDivision=`;

  const response = await fetch(url, getNBAHeaders());
  if (!response.ok) {
    throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parsePlayerDashboard(data);
}

/**
 * Merge general and advanced player stats (existing function, unchanged)
 */
function mergePlayerStats(generalData, advancedData) {
  const generalHeaders = generalData.resultSets[0].headers;
  const generalRows = generalData.resultSets[0].rowSet;
  
  const advancedHeaders = advancedData.resultSets[0].headers;
  const advancedRows = advancedData.resultSets[0].rowSet;

  // Create a map of advanced stats by player ID
  const advancedMap = {};
  advancedRows.forEach(row => {
    const playerId = row[advancedHeaders.indexOf('PLAYER_ID')];
    advancedMap[playerId] = row;
  });

  // Merge stats for each player
  return generalRows.map(generalRow => {
    const playerId = generalRow[generalHeaders.indexOf('PLAYER_ID')];
    const advancedRow = advancedMap[playerId] || [];

    return {
      playerId: playerId,
      playerName: generalRow[generalHeaders.indexOf('PLAYER_NAME')],
      teamId: generalRow[generalHeaders.indexOf('TEAM_ID')],
      teamAbbreviation: generalRow[generalHeaders.indexOf('TEAM_ABBREVIATION')],
      age: generalRow[generalHeaders.indexOf('AGE')],
      gamesPlayed: generalRow[generalHeaders.indexOf('GP')],
      gamesStarted: generalRow[generalHeaders.indexOf('GS')] || 0,
      minutes: generalRow[generalHeaders.indexOf('MIN')],
      
      // Scoring
      points: generalRow[generalHeaders.indexOf('PTS')],
      fieldGoalsMade: generalRow[generalHeaders.indexOf('FGM')],
      fieldGoalsAttempted: generalRow[generalHeaders.indexOf('FGA')],
      fieldGoalPct: generalRow[generalHeaders.indexOf('FG_PCT')],
      threePointersMade: generalRow[generalHeaders.indexOf('FG3M')],
      threePointersAttempted: generalRow[generalHeaders.indexOf('FG3A')],
      threePointPct: generalRow[generalHeaders.indexOf('FG3_PCT')],
      freeThrowsMade: generalRow[generalHeaders.indexOf('FTM')],
      freeThrowsAttempted: generalRow[generalHeaders.indexOf('FTA')],
      freeThrowPct: generalRow[generalHeaders.indexOf('FT_PCT')],
      
      // Other stats
      rebounds: generalRow[generalHeaders.indexOf('REB')],
      offensiveRebounds: generalRow[generalHeaders.indexOf('OREB')],
      defensiveRebounds: generalRow[generalHeaders.indexOf('DREB')],
      assists: generalRow[generalHeaders.indexOf('AST')],
      turnovers: generalRow[generalHeaders.indexOf('TOV')],
      steals: generalRow[generalHeaders.indexOf('STL')],
      blocks: generalRow[generalHeaders.indexOf('BLK')],
      personalFouls: generalRow[generalHeaders.indexOf('PF')],
      plusMinus: generalRow[generalHeaders.indexOf('PLUS_MINUS')],
      
      // Advanced stats (if available)
      advanced: advancedRow.length > 0 ? {
        offensiveRating: advancedRow[advancedHeaders.indexOf('OFF_RATING')],
        defensiveRating: advancedRow[advancedHeaders.indexOf('DEF_RATING')],
        netRating: advancedRow[advancedHeaders.indexOf('NET_RATING')],
        usageRate: advancedRow[advancedHeaders.indexOf('USG_PCT')],
        trueShootingPct: advancedRow[advancedHeaders.indexOf('TS_PCT')],
        effectiveFGPct: advancedRow[advancedHeaders.indexOf('EFG_PCT')],
        assistRatio: advancedRow[advancedHeaders.indexOf('AST_RATIO')],
        assistPercentage: advancedRow[advancedHeaders.indexOf('AST_PCT')],
        reboundPercentage: advancedRow[advancedHeaders.indexOf('REB_PCT')],
        turnoverRatio: advancedRow[advancedHeaders.indexOf('TM_TOV_PCT')]
      } : null
    };
  }).sort((a, b) => b.minutes - a.minutes); // Sort by minutes played
}

/**
 * Parse player dashboard data (existing function, unchanged)
 */
function parsePlayerDashboard(data) {
  const headers = data.resultSets[0].headers;
  const row = data.resultSets[0].rowSet[0];
  
  if (!row) return null;

  return {
    playerId: row[headers.indexOf('PLAYER_ID')],
    playerName: row[headers.indexOf('PLAYER_NAME')],
    teamId: row[headers.indexOf('TEAM_ID')],
    teamAbbreviation: row[headers.indexOf('TEAM_ABBREVIATION')],
    gamesPlayed: row[headers.indexOf('GP')],
    wins: row[headers.indexOf('W')],
    losses: row[headers.indexOf('L')],
    minutes: row[headers.indexOf('MIN')],
    points: row[headers.indexOf('PTS')],
    fieldGoalPct: row[headers.indexOf('FG_PCT')],
    threePointPct: row[headers.indexOf('FG3_PCT')],
    freeThrowPct: row[headers.indexOf('FT_PCT')],
    rebounds: row[headers.indexOf('REB')],
    assists: row[headers.indexOf('AST')],
    turnovers: row[headers.indexOf('TOV')],
    steals: row[headers.indexOf('STL')],
    blocks: row[headers.indexOf('BLK')],
    plusMinus: row[headers.indexOf('PLUS_MINUS')]
  };
}

/**
 * Get NBA.com API headers (existing function, unchanged)
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
 * Get current NBA season string (existing function, unchanged)
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