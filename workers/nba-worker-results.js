/**
 * NBA Results Worker - FINAL PRODUCTION VERSION
 * Deploy to: nba-worker-results.scottcinatl.workers.dev
 * 
 * Strategy:
 * 1. Use scoreboardv2 to get game IDs (ignore unreliable status)
 * 2. Use boxscoreadvancedv3 to get actual player stats + determine if finished
 * 3. Return complete data for validation system
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === '/results') {
        return await handleGameResults(url, corsHeaders);
      } else if (url.pathname === '/games-status') {
        return await handleGamesStatus(url, corsHeaders);
      } else if (url.pathname === '/boxscore') {
        return await handleBoxScore(url, corsHeaders);
      } else if (url.pathname === '/test') {
        return await handleTest(corsHeaders);
      } else {
        return new Response(JSON.stringify({ 
          error: 'Invalid endpoint',
          available: [
            '/results?date=YYYY-MM-DD - Complete game results with player stats',
            '/games-status?date=YYYY-MM-DD - Game status and basic info', 
            '/boxscore?gameId=ID - Individual game box score',
            '/test - Health check'
          ],
          note: 'Production version with reliable NBA Stats API integration!'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Get proper NBA Stats API headers
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
      cacheTtl: 300,
      cacheEverything: true
    }
  };
}

/**
 * Test endpoint
 */
async function handleTest(corsHeaders) {
  return new Response(JSON.stringify({
    success: true,
    message: 'NBA Results Worker (Production) - Ready for validation!',
    version: '1.0.0',
    strategy: 'scoreboardv2 + boxscoreadvancedv3',
    timestamp: new Date().toISOString()
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Get game IDs and basic info from scoreboardv2
 */
async function getGameIds(date) {
  const scoreboardUrl = `https://stats.nba.com/stats/scoreboardv2?DayOffset=0&GameDate=${date}&LeagueID=00`;
  const response = await fetch(scoreboardUrl, getNBAHeaders());
  
  if (!response.ok) {
    throw new Error(`Scoreboard API error: ${response.status} - ${response.statusText}`);
  }
  
  const data = await response.json();
  const gameHeaderSet = data.resultSets?.find(rs => rs.name === 'GameHeader');
  
  if (!gameHeaderSet || !gameHeaderSet.rowSet) {
    return [];
  }
  
  return gameHeaderSet.rowSet.map(row => ({
    gameId: row[2], // GAME_ID
    gameDate: row[0], // GAME_DATE_EST
    homeTeamId: row[6], // HOME_TEAM_ID
    awayTeamId: row[7], // VISITOR_TEAM_ID
    gameCode: row[5] // GAMECODE
  }));
}

/**
 * Get detailed boxscore data using traditional API for basic stats
 */
async function getGameBoxScore(gameId) {
  try {
    // Use NBA Stats boxscoretraditionalv2 API for basic counting stats
    const boxScoreUrl = `https://stats.nba.com/stats/boxscoretraditionalv2?EndPeriod=4&EndRange=0&GameID=${gameId}&RangeType=0&StartPeriod=1&StartRange=0`;
    const response = await fetch(boxScoreUrl, getNBAHeaders());
    
    if (!response.ok) {
      return { success: false, error: `BoxScore API error: ${response.status}`, gameId };
    }
    
    const data = await response.json();
    
    if (!data.resultSets) {
      return { success: false, error: 'No boxscore data available', gameId };
    }
    
    // Find PlayerStats result set
    const playerStatsSet = data.resultSets.find(rs => rs.name === 'PlayerStats');
    const teamStatsSet = data.resultSets.find(rs => rs.name === 'TeamStats');
    
    if (!playerStatsSet || !playerStatsSet.rowSet) {
      return { success: false, error: 'No player stats available', gameId };
    }
    
    // Check if game is finished by looking for players with actual minutes played
    const playersWithMinutes = playerStatsSet.rowSet.filter(row => row[8] && row[8] !== "0:00"); // MIN is index 8
    const gameFinished = playersWithMinutes.length > 0;
    
    if (!gameFinished) {
      return { success: false, error: 'Game not finished yet', gameId, finished: false };
    }
    
    // Extract player stats using the correct field mapping
    const players = [];
    const headers = playerStatsSet.headers;
    
    playerStatsSet.rowSet.forEach(row => {
      // Only include players who actually played (have minutes > 0)
      if (row[8] && row[8] !== "0:00") { // MIN field
        const playerData = {};
        headers.forEach((header, index) => {
          playerData[header] = row[index];
        });
        
        players.push({
          playerId: playerData.PLAYER_ID,
          playerName: playerData.PLAYER_NAME,
          teamId: playerData.TEAM_ID,
          teamAbbreviation: playerData.TEAM_ABBREVIATION,
          teamCity: playerData.TEAM_CITY,
          position: playerData.START_POSITION || '',
          minutes: playerData.MIN,
          points: playerData.PTS || 0,
          rebounds: playerData.REB || 0,
          assists: playerData.AST || 0,
          steals: playerData.STL || 0,
          blocks: playerData.BLK || 0,
          turnovers: playerData.TO || 0,
          fieldGoalsMade: playerData.FGM || 0,
          fieldGoalsAttempted: playerData.FGA || 0,
          fieldGoalPercentage: playerData.FG_PCT || 0,
          threePointersMade: playerData.FG3M || 0,
          threePointersAttempted: playerData.FG3A || 0,
          threePointPercentage: playerData.FG3_PCT || 0,
          freeThrowsMade: playerData.FTM || 0,
          freeThrowsAttempted: playerData.FTA || 0,
          freeThrowPercentage: playerData.FT_PCT || 0,
          offensiveRebounds: playerData.OREB || 0,
          defensiveRebounds: playerData.DREB || 0,
          personalFouls: playerData.PF || 0,
          plusMinus: playerData.PLUS_MINUS || 0
        });
      }
    });
    
    // Extract team stats
    const teams = [];
    if (teamStatsSet && teamStatsSet.rowSet) {
      teamStatsSet.rowSet.forEach(row => {
        const teamData = {};
        teamStatsSet.headers.forEach((header, index) => {
          teamData[header] = row[index];
        });
        
        teams.push({
          teamId: teamData.TEAM_ID,
          teamAbbreviation: teamData.TEAM_ABBREVIATION,
          teamCity: teamData.TEAM_CITY,
          teamName: teamData.TEAM_NAME,
          points: teamData.PTS || 0,
          rebounds: teamData.REB || 0,
          assists: teamData.AST || 0,
          steals: teamData.STL || 0,
          blocks: teamData.BLK || 0,
          turnovers: teamData.TO || 0,
          fieldGoalsMade: teamData.FGM || 0,
          fieldGoalsAttempted: teamData.FGA || 0,
          fieldGoalPercentage: teamData.FG_PCT || 0,
          threePointersMade: teamData.FG3M || 0,
          threePointersAttempted: teamData.FG3A || 0,
          threePointPercentage: teamData.FG3_PCT || 0,
          freeThrowsMade: teamData.FTM || 0,
          freeThrowsAttempted: teamData.FTA || 0,
          freeThrowPercentage: teamData.FT_PCT || 0,
          offensiveRebounds: teamData.OREB || 0,
          defensiveRebounds: teamData.DREB || 0,
          personalFouls: teamData.PF || 0,
          plusMinus: teamData.PLUS_MINUS || 0
        });
      });
    }
    
    // Get team abbreviations from first players of each team
    const homeTeam = players.find(p => p.teamId)?.teamAbbreviation || 'Unknown';
    const awayTeam = players.find(p => p.teamId && p.teamAbbreviation !== homeTeam)?.teamAbbreviation || 'Unknown';
    
    return {
      success: true,
      gameId: gameId,
      finished: gameFinished,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeTeamId: players.find(p => p.teamAbbreviation === homeTeam)?.teamId,
      awayTeamId: players.find(p => p.teamAbbreviation === awayTeam)?.teamId,
      players: players,
      teams: teams,
      playersCount: players.length
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      gameId: gameId,
      finished: false 
    };
  }
}

/**
 * Handle games status endpoint
 */
async function handleGamesStatus(url, corsHeaders) {
  const date = url.searchParams.get('date');
  if (!date) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Date parameter required (YYYY-MM-DD format)'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const gameIds = await getGameIds(date);
    
    if (gameIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        date: date,
        games: [],
        summary: { total: 0, finished: 0, ongoing: 0, scheduled: 0 },
        note: 'No games found for this date',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check each game's boxscore to determine actual status
    const games = [];
    for (const gameInfo of gameIds) {
      const boxScore = await getGameBoxScore(gameInfo.gameId);
      games.push({
        gameId: gameInfo.gameId,
        homeTeamId: gameInfo.homeTeamId,
        awayTeamId: gameInfo.awayTeamId,
        homeTeam: boxScore.homeTeam || 'Unknown',
        awayTeam: boxScore.awayTeam || 'Unknown',
        finished: boxScore.finished || false,
        status: boxScore.finished ? 'Final' : 'Scheduled',
        statusId: boxScore.finished ? 3 : 1,
        hasBoxScore: boxScore.success,
        playersFound: boxScore.playersCount || 0
      });
    }

    const summary = {
      total: games.length,
      finished: games.filter(g => g.finished).length,
      ongoing: 0, // Advanced API doesn't show live games easily
      scheduled: games.filter(g => !g.finished).length
    };

    return new Response(JSON.stringify({
      success: true,
      date: date,
      games: games,
      summary: summary,
      source: 'NBA Stats scoreboardv2 + boxscoreadvancedv3',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to fetch games status: ${error.message}`,
      date: date
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle game results with complete player stats
 */
async function handleGameResults(url, corsHeaders) {
  const date = url.searchParams.get('date');
  if (!date) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Date parameter required (YYYY-MM-DD format)'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const gameIds = await getGameIds(date);
    
    if (gameIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No games found for this date',
        date: date
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get complete boxscore data for all games
    const allGames = [];
    const finishedGames = [];

    for (const gameInfo of gameIds) {
      const boxScore = await getGameBoxScore(gameInfo.gameId);
      
      const gameData = {
        gameId: gameInfo.gameId,
        gameDate: date,
        homeTeamId: gameInfo.homeTeamId,
        awayTeamId: gameInfo.awayTeamId,
        homeTeam: boxScore.homeTeam || 'Unknown',
        awayTeam: boxScore.awayTeam || 'Unknown',
        finished: boxScore.finished || false,
        status: boxScore.finished ? 'Final' : 'Scheduled',
        boxScoreAvailable: boxScore.success
      };

      allGames.push(gameData);

      if (boxScore.finished && boxScore.success) {
        finishedGames.push({
          ...gameData,
          players: boxScore.players,
          teams: boxScore.teams
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: date,
      allGames: allGames,
      finishedGames: finishedGames,
      summary: {
        totalGames: allGames.length,
        finishedGames: finishedGames.length,
        totalPlayers: finishedGames.reduce((sum, game) => sum + (game.players?.length || 0), 0)
      },
      note: 'Complete player statistics included for finished games',
      source: 'NBA Stats APIs (scoreboardv2 + boxscoreadvancedv3)',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to fetch game results: ${error.message}`,
      date: date
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle individual boxscore
 */
async function handleBoxScore(url, corsHeaders) {
  const gameId = url.searchParams.get('gameId');
  if (!gameId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'gameId parameter required'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const boxScore = await getGameBoxScore(gameId);
    
    if (!boxScore.success) {
      return new Response(JSON.stringify({
        success: false,
        error: boxScore.error,
        gameId: gameId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      gameId: gameId,
      finished: boxScore.finished,
      homeTeam: boxScore.homeTeam,
      awayTeam: boxScore.awayTeam,
      players: boxScore.players,
      teams: boxScore.teams,
      playersCount: boxScore.playersCount,
      source: 'NBA Stats boxscoreadvancedv3',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to fetch box score: ${error.message}`,
      gameId: gameId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}