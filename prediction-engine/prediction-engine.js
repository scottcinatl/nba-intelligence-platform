#!/usr/bin/env node

/**
 * NBA Game Analyzer - BEST OF BOTH WORLDS
 * 
 * Combines:
 * - Working data patterns from workingAnalyzer.js
 * - Enhanced star/player impact detection 
 * - PDF injury data enhancement
 * - Beautiful table displays
 * - Clear data source logging
 */

import fs from 'fs';
import path from 'path';

// PDF parsing setup
let pdf = null;
try {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  pdf = require('pdf-parse');
  
  if (typeof pdf !== 'function') {
    if (pdf.default && typeof pdf.default === 'function') {
      pdf = pdf.default;
    } else {
      pdf = null;
    }
  }
  
  if (pdf) {
    console.log('✅ PDF parsing available for enhanced injury data');
  } else {
    console.log('⚠️  PDF parsing not available - will use base injury data only');
  }
} catch (e) {
  console.log('⚠️  PDF parsing not available - will use base injury data only');
  pdf = null;
}

console.log('🏀 NBA GAME ANALYZER - ENHANCED WITH SMART IMPACT DETECTION');
console.log('📊 Real NBA Stats + PDF Injury Enhancement + Player Impact Analysis');
console.log('='.repeat(80));
console.log('');

const WORKER_BASE = 'https://nba-worker';
const WORKER_DOMAIN = 'scottcinatl.workers.dev';

const WORKERS = {
  games: `${WORKER_BASE}-games.${WORKER_DOMAIN}`,
  teams: `${WORKER_BASE}-teams.${WORKER_DOMAIN}`,
  players: `${WORKER_BASE}-players.${WORKER_DOMAIN}`,
  injuries: `${WORKER_BASE}-injuries.${WORKER_DOMAIN}`,
  gamenotes: `${WORKER_BASE}-gamenotes.${WORKER_DOMAIN}`,
  injuriesOfficial: `${WORKER_BASE}-injuries-official.${WORKER_DOMAIN}`,
  // NEW: Advanced matchup analysis workers
  lineups: `${WORKER_BASE}-lineups.${WORKER_DOMAIN}`,
  // NEW: Team style profiling worker
  teamstyle: `${WORKER_BASE}-teamstyle.${WORKER_DOMAIN}`
};

// Enhanced CSV data collectors for multiple sheets
let gameData = [];
let playerData = [];  
let gameScriptData = [];
let gameScriptAnalysisData = null;

async function main() {
  const args = process.argv.slice(2);
  const isQuickScan = args.includes('--quick');
  const gameFilter = args.find(arg => arg.startsWith('--game='))?.split('=')[1];
  
  try {
    console.log('📅 Fetching today\'s games...');
    const gamesData = await fetchGames();
    
    if (!gamesData.success || gamesData.gameCount === 0) {
      console.log('❌ No games found for today.');
      return;
    }
    
    console.log(`✅ Found ${gamesData.gameCount} games\n`);
    
    // Filter games if specific game requested
    let gamesToAnalyze = gamesData.games;
    if (gameFilter) {
      const [away, home] = gameFilter.toUpperCase().split('-');
      gamesToAnalyze = gamesData.games.filter(g => 
        g.awayTeam.abbreviation === away && g.homeTeam.abbreviation === home
      );
      if (gamesToAnalyze.length === 0) {
        console.log(`❌ Game ${gameFilter} not found.`);
        return;
      }
    }
    
    // Quick scan mode
    if (isQuickScan) {
      await quickScanGames(gamesToAnalyze);
      return;
    }
    
    // Full analysis mode
    for (let i = 0; i < gamesToAnalyze.length; i++) {
      const game = gamesToAnalyze[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`ANALYZING GAME ${i + 1} of ${gamesToAnalyze.length}`);
      console.log('='.repeat(80));
      
      await analyzeGame(game);
    }
    
    // Save CSV output
    const date = new Date().toISOString().split('T')[0];
    await saveCsvOutput(date);
    
    console.log('\n\n✅ Analysis complete!');
    console.log(`📁 Results saved to: output/${date}.csv`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

async function quickScanGames(games) {
  console.log('📊 QUICK SCAN - Today\'s Games\n');
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`\n${i + 1}. ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} - ${game.time}`);
    console.log('   ' + '─'.repeat(50));
    
    try {
      const [awayTeamStats, homeTeamStats] = await Promise.all([
        fetchTeamStats(game.awayTeam.id, 5),
        fetchTeamStats(game.homeTeam.id, 5)
      ]);
      
      const awayGeneral = awayTeamStats.data?.general || {};
      const homeGeneral = homeTeamStats.data?.general || {};
      const awayAdv = awayTeamStats.data?.advanced || {};
      const homeAdv = homeTeamStats.data?.advanced || {};
      
      console.log(`   ${game.awayTeam.name} (${awayGeneral.wins || 0}-${awayGeneral.losses || 0})`);
      console.log(`   • PPG: ${awayGeneral.points || 'N/A'} | OffRtg: ${awayAdv.offensiveRating || 'N/A'} | DefRtg: ${awayAdv.defensiveRating || 'N/A'}`);
      console.log('');
      console.log(`   ${game.homeTeam.name} (${homeGeneral.wins || 0}-${homeGeneral.losses || 0})`);
      console.log(`   • PPG: ${homeGeneral.points || 'N/A'} | OffRtg: ${homeAdv.offensiveRating || 'N/A'} | DefRtg: ${homeAdv.defensiveRating || 'N/A'}`);
      
      const awayScore = calculatePredictedScore(awayAdv, homeAdv, false, 0);
      const homeScore = calculatePredictedScore(homeAdv, awayAdv, true, 0);
      console.log('');
      console.log(`   Prediction: ${game.awayTeam.abbreviation} ${awayScore}, ${game.homeTeam.abbreviation} ${homeScore}`);
      
    } catch (error) {
      console.log(`   ⚠️  Error fetching data: ${error.message}`);
    }
  }
  
  console.log('\n\n💡 For detailed analysis, run: node index.js');
  console.log('💡 For specific game: node index.js --game=PHI-WAS');
}

async function fetchGames() {
  const response = await fetch(`${WORKERS.games}/games`);
  return await response.json();
}

async function fetchTeamStats(teamId, lastN = 5) {
  const response = await fetch(`${WORKERS.teams}/teams?id=${teamId}&lastN=${lastN}`);
  return await response.json();
}

async function fetchPlayerStats(teamId, lastN = 5) {
  const response = await fetch(`${WORKERS.players}/players?team=${teamId}&lastN=${lastN}`);
  return await response.json();
}

async function fetchInjuries(teamAbbr) {
  const response = await fetch(`${WORKERS.injuries}/injuries?team=${teamAbbr}`);
  return await response.json();
}

/**
 * ENHANCED: Fetch injuries from official NBA injury report
 */
async function fetchInjuriesWithOfficial() {
  let dataSource = 'NBA_OFFICIAL';
  let pdfEnhanced = false;
  
  try {
    console.log(`📋 Fetching official NBA injury report...`);
    
    const officialResponse = await fetch(`${WORKERS.injuriesOfficial}/`);
    const officialData = await officialResponse.json();
    
    if (officialData.success && officialData.pdfUrl) {
      console.log(`   📄 Downloading official report: ${officialData.pdfUrl}`);
      
      if (pdf) {
        try {
          const pdfResponse = await fetch(officialData.pdfUrl);
          if (pdfResponse.ok) {
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            console.log(`   📝 Parsing official injury report...`);
            const data = await pdf(buffer);
            const text = data.text;
            
            console.log(`   ✅ Official report parsed! ${text.length} characters extracted`);
            
            const allInjuries = parseOfficialInjuryReport(text);
            console.log(`   📊 Extracted: ${allInjuries.length} total injuries from official report`);
            
            pdfEnhanced = true;
            dataSource = 'NBA_OFFICIAL_PARSED';
            
            return {
              success: true,
              allInjuries,
              dataSource,
              pdfEnhanced,
              pdfUrl: officialData.pdfUrl,
              rawPdfLength: text.length
            };
          }
        } catch (pdfError) {
          console.log(`   ⚠️  Official report parsing failed: ${pdfError.message}`);
        }
      } else {
        console.log(`   ⚠️  PDF parsing not available`);
      }
    } else {
      console.log(`   ⚠️  Official injury report not available: ${officialData.error}`);
    }
    
    return {
      success: false,
      allInjuries: [],
      dataSource: 'UNAVAILABLE',
      pdfEnhanced: false
    };
    
  } catch (error) {
    console.log(`   ⚠️  Official injury report error: ${error.message}`);
    return {
      success: false,
      allInjuries: [],
      dataSource: 'UNAVAILABLE',
      pdfEnhanced: false
    };
  }
}

/**
 * Analyze if a player has an elevated role based on recent form vs season averages
 * Based on basketball analytics research using 3-game windows and usage metrics
 */
function analyzePlayerRoleElevation(player) {
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
function calculateReturnImpact(returningPlayer, teammate, teammateElevation) {
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
      baseImpact = -0.20; // -20% significant impact
      break;
    case 'Star':
      baseImpact = -0.15; // -15% moderate impact
      break;
    case 'Key Role':
      baseImpact = -0.08; // -8% minor impact
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
function enhancePlayerData(players) {
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
function playerMissedRecentGames(player, teamStats) {
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
 * Calculate dynamic home court advantage based on actual home/away records
 */
function calculateDynamicHomeAdvantage(homeTeamStats, awayTeamStats) {
  // Default home advantage if we don't have home/away splits
  const defaultHomeAdvantage = 2.5;
  
  if (!homeTeamStats.homeRecord || !awayTeamStats.awayRecord) {
    return defaultHomeAdvantage;
  }
  
  // Calculate actual home/away performance
  const homeWinPct = homeTeamStats.homeRecord.wins / 
    (homeTeamStats.homeRecord.wins + homeTeamStats.homeRecord.losses);
  
  const awayWinPct = awayTeamStats.awayRecord.wins / 
    (awayTeamStats.awayRecord.wins + awayTeamStats.awayRecord.losses);
  
  // If we don't have enough home/away games, use overall record + small home boost
  const homeGames = homeTeamStats.homeRecord.wins + homeTeamStats.homeRecord.losses;
  const awayGames = awayTeamStats.awayRecord.wins + awayTeamStats.awayRecord.losses;
  
  if (homeGames < 2 || awayGames < 2) {
    // Early season: use overall record + small home boost
    const homeOverallWinPct = homeTeamStats.wins / (homeTeamStats.wins + homeTeamStats.losses);
    const awayOverallWinPct = awayTeamStats.wins / (awayTeamStats.wins + awayTeamStats.losses);
    
    // Home advantage = difference in overall records + 1.5 point baseline
    const recordDifference = (homeOverallWinPct - awayOverallWinPct) * 10; // Scale to points
    return Math.max(0, Math.min(6, 1.5 + recordDifference)); // Cap between 0-6 points
  }
  
  // Mid/late season: use actual home vs away performance
  const homeAdvantage = (homeWinPct - awayWinPct) * 8; // Scale to points
  return Math.max(0, Math.min(8, homeAdvantage + 1.0)); // 1 point baseline + performance
}

/**
 * Calculate team strength differential with more weight on record
 */
function calculateTeamStrengthDifferential(homeTeam, awayTeam, homeTeamStats, awayTeamStats) {
  // Record-based component (more weight in early season)
  const homeWinPct = homeTeamStats.wins / (homeTeamStats.wins + homeTeamStats.losses);
  const awayWinPct = awayTeamStats.wins / (awayTeamStats.wins + awayTeamStats.losses);
  const recordDifferential = (homeWinPct - awayWinPct) * 12; // 12 point swing for 100% vs 0%
  
  // Performance-based component (offensive/defensive rating)
  const homeNetRating = (homeTeamStats.offensiveRating || 110) - (homeTeamStats.defensiveRating || 110);
  const awayNetRating = (awayTeamStats.offensiveRating || 110) - (awayTeamStats.defensiveRating || 110);
  const performanceDifferential = (homeNetRating - awayNetRating) * 0.3; // Scale down
  
  // Weight record more heavily in early season
  const gamesPlayed = homeTeamStats.wins + homeTeamStats.losses;
  const recordWeight = gamesPlayed < 10 ? 0.7 : 0.5; // 70% early season, 50% later
  const performanceWeight = 1 - recordWeight;
  
  return (recordDifferential * recordWeight) + (performanceDifferential * performanceWeight);
}

/**
 * Normalize a player name for comparison
 */
function normalizePlayerName(name) {
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
function playersMatch(playerName, injuryName) {
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
 * Parse the official NBA injury report PDF (concatenated format with no spaces)
 */
function parseOfficialInjuryReport(text) {
  const injuries = [];
  
  try {
    // The official report has all text concatenated with no spaces
    const lines = text.split('\n');
    let currentTeam = null; // Track current team for continuation lines
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || line.includes('GameDate') || line.includes('Page') || 
          line.includes('InjuryReport:') || line.length < 10) {
        continue;
      }
      
      // Check if this line has a team name (establishes context)
      const teamFromLine = getTeamFromLine(line);
      if (teamFromLine) {
        currentTeam = teamFromLine;
      }
      
      // Look for lines that contain injury status (concatenated format)
      if (line.includes('Out') || line.includes('Probable') || line.includes('Questionable') || line.includes('Doubtful')) {
        
        // Try to extract player injury data from the concatenated line
        const injuryData = parseInjuryFromConcatenatedLine(line, currentTeam);
        if (injuryData) {
          injuries.push(injuryData);
        }
      }
    }
    
    // Simple summary instead of detailed team breakdown
    console.log(`   📊 Extracted: ${injuries.length} total injuries from official report`);
    
  } catch (error) {
    console.log(`   ⚠️  Error parsing official injury report: ${error.message}`);
  }
  
  return injuries;
}

/**
 * Extract team abbreviation from a line if it contains a team name
 */
function getTeamFromLine(line) {
  const teamPatterns = [
    { pattern: 'HoustonRockets', abbr: 'HOU' },
    { pattern: 'TorontoRaptors', abbr: 'TOR' },
    { pattern: 'ClevelandCavaliers', abbr: 'CLE' },
    { pattern: 'BostonCeltics', abbr: 'BOS' },
    { pattern: 'OrlandoMagic', abbr: 'ORL' },
    { pattern: 'DetroitPistons', abbr: 'DET' },
    { pattern: 'AtlantaHawks', abbr: 'ATL' },
    { pattern: 'BrooklynNets', abbr: 'BKN' },
    { pattern: 'CharlotteHornets', abbr: 'CHA' },
    { pattern: 'ChicagoBulls', abbr: 'CHI' },
    { pattern: 'DallasMavericks', abbr: 'DAL' },
    { pattern: 'DenverNuggets', abbr: 'DEN' },
    { pattern: 'GoldenStateWarriors', abbr: 'GSW' },
    { pattern: 'IndianaPacers', abbr: 'IND' },
    { pattern: 'LAClippers', abbr: 'LAC' },
    { pattern: 'LosAngelesLakers', abbr: 'LAL' },
    { pattern: 'MemphisGrizzlies', abbr: 'MEM' },
    { pattern: 'MiamiHeat', abbr: 'MIA' },
    { pattern: 'MilwaukeeBucks', abbr: 'MIL' },
    { pattern: 'MinnesotaTimberwolves', abbr: 'MIN' },
    { pattern: 'NewOrleansPelicans', abbr: 'NOP' },
    { pattern: 'NewYorkKnicks', abbr: 'NYK' },
    { pattern: 'OklahomaCityThunder', abbr: 'OKC' },
    { pattern: 'Philadelphia76ers', abbr: 'PHI' },
    { pattern: 'PhoenixSuns', abbr: 'PHX' },
    { pattern: 'PortlandTrailBlazers', abbr: 'POR' },
    { pattern: 'SacramentoKings', abbr: 'SAC' },
    { pattern: 'SanAntonioSpurs', abbr: 'SAS' },
    { pattern: 'UtahJazz', abbr: 'UTA' },
    { pattern: 'WashingtonWizards', abbr: 'WAS' }
  ];
  
  for (const team of teamPatterns) {
    if (line.includes(team.pattern)) {
      return team.abbr;
    }
  }
  
  return null;
}

/**
 * Parse injury data from a concatenated line (no spaces between fields)
 */
function parseInjuryFromConcatenatedLine(line, fallbackTeam = null) {
  try {
    // First try to find team in the line itself
    let teamAbbr = getTeamFromLine(line);
    let teamPattern = null;
    
    if (teamAbbr) {
      // Find the team pattern that matched
      const teamPatterns = [
        { pattern: 'HoustonRockets', abbr: 'HOU' },
        { pattern: 'TorontoRaptors', abbr: 'TOR' },
        { pattern: 'ClevelandCavaliers', abbr: 'CLE' },
        { pattern: 'BostonCeltics', abbr: 'BOS' },
        { pattern: 'OrlandoMagic', abbr: 'ORL' },
        { pattern: 'DetroitPistons', abbr: 'DET' },
        { pattern: 'AtlantaHawks', abbr: 'ATL' },
        { pattern: 'BrooklynNets', abbr: 'BKN' },
        { pattern: 'CharlotteHornets', abbr: 'CHA' },
        { pattern: 'ChicagoBulls', abbr: 'CHI' },
        { pattern: 'DallasMavericks', abbr: 'DAL' },
        { pattern: 'DenverNuggets', abbr: 'DEN' },
        { pattern: 'GoldenStateWarriors', abbr: 'GSW' },
        { pattern: 'IndianaPacers', abbr: 'IND' },
        { pattern: 'LAClippers', abbr: 'LAC' },
        { pattern: 'LosAngelesLakers', abbr: 'LAL' },
        { pattern: 'MemphisGrizzlies', abbr: 'MEM' },
        { pattern: 'MiamiHeat', abbr: 'MIA' },
        { pattern: 'MilwaukeeBucks', abbr: 'MIL' },
        { pattern: 'MinnesotaTimberwolves', abbr: 'MIN' },
        { pattern: 'NewOrleansPelicans', abbr: 'NOP' },
        { pattern: 'NewYorkKnicks', abbr: 'NYK' },
        { pattern: 'OklahomaCityThunder', abbr: 'OKC' },
        { pattern: 'Philadelphia76ers', abbr: 'PHI' },
        { pattern: 'PhoenixSuns', abbr: 'PHX' },
        { pattern: 'PortlandTrailBlazers', abbr: 'POR' },
        { pattern: 'SacramentoKings', abbr: 'SAC' },
        { pattern: 'SanAntonioSpurs', abbr: 'SAS' },
        { pattern: 'UtahJazz', abbr: 'UTA' },
        { pattern: 'WashingtonWizards', abbr: 'WAS' }
      ];
      
      for (const team of teamPatterns) {
        if (line.includes(team.pattern) && team.abbr === teamAbbr) {
          teamPattern = team.pattern;
          break;
        }
      }
    } else if (fallbackTeam) {
      // Use fallback team for continuation lines
      teamAbbr = fallbackTeam;
    }
    
    if (!teamAbbr) {
      return null; // No team found
    }
    
    // Extract the part after the team name (or the whole line if no team pattern)
    let afterTeam = line;
    if (teamPattern) {
      afterTeam = line.substring(line.indexOf(teamPattern) + teamPattern.length);
    }
    
    // Status patterns (need to be specific to avoid conflicts)
    let status = null;
    let statusPattern = null;
    
    if (afterTeam.includes('OutInjury/Illness') || afterTeam.includes('OutGLeague') || 
        afterTeam.includes('OutNotWithTeam') || afterTeam.match(/[A-Z]Out[A-Z]/) ||
        afterTeam.endsWith('Out')) {
      status = 'out';
      statusPattern = 'Out';
    } else if (afterTeam.includes('ProbableInjury/Illness') || afterTeam.match(/[A-Z]Probable[A-Z]/) ||
               afterTeam.endsWith('Probable')) {
      status = 'probable';
      statusPattern = 'Probable';
    } else if (afterTeam.includes('QuestionableInjury/Illness') || afterTeam.match(/[A-Z]Questionable[A-Z]/)) {
      status = 'questionable';
      statusPattern = 'Questionable';
    } else if (afterTeam.includes('DoubtfulInjury/Illness') || afterTeam.match(/[A-Z]Doubtful[A-Z]/)) {
      status = 'doubtful';
      statusPattern = 'Doubtful';
    }
    
    if (!status) {
      return null; // No status found
    }
    
    // Extract player name (between start and status)
    const statusIndex = afterTeam.indexOf(statusPattern);
    if (statusIndex === -1) {
      return null;
    }
    
    const nameSection = afterTeam.substring(0, statusIndex);
    
    // Player names often have comma (Last,First format)
    let playerName = nameSection;
    
    // Clean up common concatenated patterns
    if (playerName.includes(',')) {
      // Handle "Last,First" format
      const commaParts = playerName.split(',');
      if (commaParts.length >= 2) {
        playerName = `${commaParts[0]}, ${commaParts[1]}`;
      }
    }
    
    // Validate we have a reasonable name
    if (!playerName || playerName.length < 3) {
      return null;
    }
    
    // Extract description (after status)
    let description = 'Injury/Illness';
    const afterStatusIndex = afterTeam.indexOf(statusPattern) + statusPattern.length;
    const afterStatus = afterTeam.substring(afterStatusIndex);
    
    if (afterStatus && afterStatus.length > 3) {
      // Clean up common patterns
      let cleanDesc = afterStatus;
      if (cleanDesc.startsWith('Injury/Illness-')) {
        cleanDesc = cleanDesc.substring('Injury/Illness-'.length);
      } else if (cleanDesc.startsWith('GLeague-')) {
        cleanDesc = 'G League - ' + cleanDesc.substring('GLeague-'.length);
      }
      
      // Add spaces to common patterns
      cleanDesc = cleanDesc.replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase to spaced
      cleanDesc = cleanDesc.replace(/;/g, '; '); // Add space after semicolons
      
      description = cleanDesc;
    }
    
    return {
      teamAbbreviation: teamAbbr,
      playerName: playerName,
      status: status,
      description: description,
      source: 'NBA_OFFICIAL'
    };
    
  } catch (error) {
    return null;
  }
}

/**
 * Get injuries for a specific team from the official report
 */
function getTeamInjuries(allInjuries, teamAbbr) {
  return allInjuries.filter(injury => 
    injury.teamAbbreviation === teamAbbr.toUpperCase()
  );
}

/**
 * ENHANCED: Fetch game notes for H2H and situational data (not injuries)
 */
async function fetchGameNotesForContext(teamAbbr) {
  try {
    console.log(`📋 Fetching game context for ${teamAbbr}...`);
    
    const gamenoteResponse = await fetch(`${WORKERS.gamenotes}/gamenotes?team=${teamAbbr}`);
    const gamenoteData = await gamenoteResponse.json();
    
    if (gamenoteData.success && gamenoteData.pdfUrl && pdf) {
      console.log(`   📄 Downloading game notes: ${gamenoteData.pdfUrl}`);
      
      try {
        const pdfResponse = await fetch(gamenoteData.pdfUrl);
        if (pdfResponse.ok) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log(`   📝 Parsing game notes for context...`);
          const data = await pdf(buffer);
          const text = data.text;
          
          console.log(`   ✅ Game notes parsed! ${text.length} characters extracted`);
          
          const contextData = parseGameNotesContext(text);
          console.log(`   📊 Extracted: ${contextData.h2hGames.length} H2H games, ${contextData.trends.length} trends`);
          
          return {
            success: true,
            team: teamAbbr.toUpperCase(),
            dataSource: 'GAME_NOTES_PARSED',
            pdfUrl: gamenoteData.pdfUrl,
            h2hGames: contextData.h2hGames,
            teamTrends: contextData.trends,
            situationalStats: contextData.situational,
            rawTextLength: text.length
          };
        }
      } catch (pdfError) {
        console.log(`   ⚠️  Game notes parsing failed: ${pdfError.message}`);
      }
    } else {
      console.log(`   ⚠️  Game notes not available: ${gamenoteData.error || 'PDF parsing unavailable'}`);
    }
    
    return {
      success: false,
      team: teamAbbr.toUpperCase(),
      dataSource: 'UNAVAILABLE',
      h2hGames: [],
      teamTrends: [],
      situationalStats: []
    };
    
  } catch (error) {
    console.log(`   ⚠️  Game notes error: ${error.message}`);
    return {
      success: false,
      team: teamAbbr.toUpperCase(),
      dataSource: 'UNAVAILABLE',
      h2hGames: [],
      teamTrends: [],
      situationalStats: []
    };
  }
}

/**
 * Parse game notes for contextual data (H2H, trends, situational stats)
 */
function parseGameNotesContext(text) {
  const h2hGames = [];
  const trends = [];
  const situational = [];
  
  try {
    // Parse Head-to-Head history
    const h2hMatches = text.match(/VS\.?\s+[A-Z]{3,}[\s\S]*?(?=\n\n|\n[A-Z][A-Z\s]{10,})/gi);
    if (h2hMatches) {
      h2hMatches.forEach(section => {
        const gameResults = section.match(/\d{1,2}\/\d{1,2}\/?\d{0,4}.*?\d{2,3}-\d{2,3}/g);
        if (gameResults) {
          gameResults.forEach(result => {
            h2hGames.push({
              result: result.trim()
            });
          });
        }
      });
    }
    
    // Parse team trends (record when...)
    const trendMatches = text.match(/[A-Za-z\s]+ record when [^:]+:\s*\d+-\d+/gi);
    if (trendMatches) {
      trendMatches.forEach(trend => {
        const parts = trend.split(':');
        if (parts.length === 2) {
          trends.push({
            condition: parts[0].trim(),
            record: parts[1].trim()
          });
        }
      });
    }
    
    // Parse situational stats (home/road, back-to-backs, etc.)
    const situationalMatches = text.match(/(home|road|back-to-back|vs\s+[A-Z]{2,}).*?record.*?\d+-\d+/gi);
    if (situationalMatches) {
      situationalMatches.forEach(stat => {
        situational.push({
          situation: stat.trim()
        });
      });
    }
    
  } catch (error) {
    console.log(`   ⚠️  Error parsing game notes context: ${error.message}`);
  }
  
  return {
    h2hGames,
    trends,
    situational
  };
}

/**
 * ENHANCED: Calculate player impact score for smart injury adjustments
 */
function calculatePlayerImpact(player) {
  if (!player) return { score: 0, tier: 'Bench' };
  
  const pointsWeight = (player.points || 0) * 1.0;
  const assistsWeight = (player.assists || 0) * 1.5;
  const reboundsWeight = (player.rebounds || 0) * 1.2;
  const stealsWeight = (player.steals || 0) * 2.0;
  const blocksWeight = (player.blocks || 0) * 2.0;
  
  const impactScore = pointsWeight + assistsWeight + reboundsWeight + 
                      stealsWeight + blocksWeight;
  
  let tier = 'Bench';
  if (impactScore > 40) tier = 'Superstar';
  else if (impactScore > 25) tier = 'Star';
  else if (impactScore > 15) tier = 'Key Role';
  
  return {
    score: impactScore,
    tier: tier
  };
}

/**
 * ENHANCED: Apply smart injury impact adjustments
 */
function applyInjuryImpact(players, injuries, teamStats) {
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

/**
 * NEW: Calculate injury status impact with probability weighting and effectiveness reduction
 */
function calculateInjuryStatusImpact(player, injury) {
  const statusImpacts = {
    'out': { playProbability: 0.0, effectiveness: 0.0, description: 'Will not play' },
    'doubtful': { playProbability: 0.20, effectiveness: 0.60, description: '20% plays, limited if active' },
    'questionable': { playProbability: 0.65, effectiveness: 0.75, description: '65% plays, may be limited' },
    'probable': { playProbability: 0.90, effectiveness: 0.95, description: '90% plays, near full effectiveness' }
  };
  
  const impact = statusImpacts[injury.status] || { playProbability: 1.0, effectiveness: 1.0, description: 'Full availability' };
  
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
 * NEW: Calculate conditional teammate boosts based on uncertain star availability
 */
function calculateConditionalTeammateBoosts(players, injuries) {
  let boostMultiplier = 1.0;
  let boostReasons = [];
  
  // Find questionable/doubtful players and their impact
  const uncertainPlayers = injuries.filter(inj => 
    ['questionable', 'doubtful'].includes(inj.status)
  );
  
  uncertainPlayers.forEach(injury => {
    const player = players.find(p => playersMatch(p.playerName, injury.playerName));
    if (!player) return;
    
    const tier = player.impact?.tier;
    const statusImpact = calculateInjuryStatusImpact(player, injury);
    
    // More aggressive boosts for uncertain stars
    if (tier === 'Superstar' || tier === 'Star') {
      if (injury.status === 'questionable') {
        boostMultiplier += 0.4; // 40% bigger boosts
        boostReasons.push(`${player.playerName} questionable (${Math.round(statusImpact.playProbability * 100)}% plays)`);
      } else if (injury.status === 'doubtful') {
        boostMultiplier += 0.6; // 60% bigger boosts  
        boostReasons.push(`${player.playerName} doubtful (${Math.round(statusImpact.playProbability * 100)}% plays)`);
      }
    } else if (tier === 'Role Player' && player.minutes > 20) {
      // Moderate boosts for uncertain key role players
      if (['questionable', 'doubtful'].includes(injury.status)) {
        boostMultiplier += 0.2; // 20% bigger boosts
        boostReasons.push(`${player.playerName} ${injury.status} (role player)`);
      }
    }
  });
  
  return {
    multiplier: Math.min(boostMultiplier, 2.0), // Cap at 2x boost
    reasons: boostReasons
  };
}

/**
 * Simple injury impact logic for early season (< 10 games)
 */
function applyEarlySeasonInjuryImpact(playersWithImpact, injuries, teamStats) {
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
  
  // NEW: Calculate conditional teammate boost multiplier
  const conditionalBoosts = calculateConditionalTeammateBoosts(playersWithImpact, injuries);
  
  // Apply enhanced adjustments with probability weighting
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
    
    // POSITIVE ADJUSTMENTS: Boost when key players are out
    injuredPlayers.forEach(injuredPlayer => {
      if (injuredPlayer.impact.tier !== 'Bench' && player.playerName !== injuredPlayer.playerName) {
        let boost = 0;
        
        switch (injuredPlayer.impact.tier) {
          case 'Superstar':
            boost = 0.20; // 20% boost when superstar out
            break;
          case 'Star':
            boost = 0.15; // 15% boost when star out
            break;
          case 'Key Role':
            boost = 0.08; // 8% boost when key role player out
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
            reduction = -0.08; // 8% reduction (conservative early season)
            break;
          case 'Star':
            reduction = -0.05; // 5% reduction
            break;
          case 'Key Role':
            reduction = -0.03; // 3% reduction
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
function applyAdvancedInjuryImpact(players, injuries, teamStats) {
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
            boost = 0.20;
            break;
          case 'Star':
            boost = 0.15;
            break;
          case 'Key Role':
            boost = 0.08;
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
 * Main game analysis function
 */
async function analyzeGame(game) {
  const awayTeam = game.awayTeam;
  const homeTeam = game.homeTeam;
  
  console.log(`\n## ${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`);
  console.log(`**${awayTeam.name}** @ **${homeTeam.name}**`);
  console.log(`Time: ${game.time}`);
  console.log('');
  
  console.log('📊 Fetching data...');
  
  const [
    awayTeamStats,
    homeTeamStats,
    awayPlayers,
    homePlayers,
    officialInjuries,
    // NEW: Lineup data
    awayLineups,
    homeLineups,
    // NEW: Team style data
    awayTeamStyle,
    homeTeamStyle
  ] = await Promise.all([
    fetchTeamStats(awayTeam.id, 5),
    fetchTeamStats(homeTeam.id, 5),
    fetchPlayerStats(awayTeam.id, 5),
    fetchPlayerStats(homeTeam.id, 5),
    fetchInjuriesWithOfficial(),
    // NEW: Fetch lineup combinations for both teams  
    fetchTeamLineups(awayTeam.id),
    fetchTeamLineups(homeTeam.id),
    // NEW: Fetch team style profiles
    fetchTeamStyleProfile(awayTeam.id),
    fetchTeamStyleProfile(homeTeam.id)
  ]);
  
  console.log('✅ Data fetched\n');
  
  // Log team style data availability for debugging
  if (awayTeamStyle.success && awayTeamStyle.profile) {
    const awayPace = awayTeamStyle.profile.offensiveStyle?.pace;
    const awayOffRtg = awayTeamStyle.profile.offensiveStyle?.offensiveRating;
    const awayDefRtg = awayTeamStyle.profile.defensiveStyle?.defensiveRating;
    console.log(`🔍 ${awayTeam.abbreviation} Style Data: Pace=${awayPace !== null ? awayPace : 'N/A'}, OffRtg=${awayOffRtg !== null ? awayOffRtg : 'N/A'}, DefRtg=${awayDefRtg !== null ? awayDefRtg : 'N/A'}`);
  }
  
  if (homeTeamStyle.success && homeTeamStyle.profile) {
    const homePace = homeTeamStyle.profile.offensiveStyle?.pace;
    const homeOffRtg = homeTeamStyle.profile.offensiveStyle?.offensiveRating;
    const homeDefRtg = homeTeamStyle.profile.defensiveStyle?.defensiveRating;
    console.log(`🔍 ${homeTeam.abbreviation} Style Data: Pace=${homePace !== null ? homePace : 'N/A'}, OffRtg=${homeOffRtg !== null ? homeOffRtg : 'N/A'}, DefRtg=${homeDefRtg !== null ? homeDefRtg : 'N/A'}`);
  }
  console.log('');
  
  // Get team-specific injuries from the official report
  const awayInjuries = getTeamInjuries(officialInjuries.allInjuries || [], awayTeam.abbreviation);
  const homeInjuries = getTeamInjuries(officialInjuries.allInjuries || [], homeTeam.abbreviation);
  
  // Apply our enhanced injury impact analysis
  const awayPlayersAdjusted = applyInjuryImpact(awayPlayers.players, awayInjuries, awayTeamStats);
  const homePlayersAdjusted = applyInjuryImpact(homePlayers.players, homeInjuries, homeTeamStats);
  
  generateGameAnalysis(game, {
    away: {
      team: awayTeam,
      stats: awayTeamStats.data,
      players: awayPlayersAdjusted,
      injuries: awayInjuries,
      injuryDataSource: officialInjuries.dataSource,
      pdfEnhanced: officialInjuries.pdfEnhanced,
      // NEW: Team style and lineup context for enhanced projections
      teamStyle: awayTeamStyle,
      lineups: awayLineups
    },
    home: {
      team: homeTeam,
      stats: homeTeamStats.data,
      players: homePlayersAdjusted,
      injuries: homeInjuries,
      injuryDataSource: officialInjuries.dataSource,
      pdfEnhanced: officialInjuries.pdfEnhanced,
      // NEW: Team style and lineup context for enhanced projections
      teamStyle: homeTeamStyle,
      lineups: homeLineups
    }
  });

  // NEW: Display enhanced analysis including team styles
  displayEnhancedMatchupAnalysis(awayTeam, homeTeam, awayLineups, homeLineups, awayTeamStyle, homeTeamStyle);
}

/**
 * Generate complete game analysis with enhanced displays
 */
function generateGameAnalysis(game, data) {
  const away = data.away;
  const home = data.home;
  
  console.log(`# ${away.team.name} @ ${home.team.name}`);
  console.log(`**Time:** ${game.time} | **Date:** ${game.date.split('T')[0]}`);
  console.log('');
  
  // Show data sources
  console.log('## DATA SOURCES');
  console.log('');
  console.log(`**${away.team.abbreviation}:**`);
  console.log(`✅ Team Stats: NBA API (Real)`);
  console.log(`✅ Player Stats: NBA API (Real)`);
  console.log(`${away.pdfEnhanced ? '✅' : '⚠️'}  Injury Data: ${away.injuryDataSource}${away.pdfEnhanced ? ' (PDF Enhanced)' : ''}`);
  console.log('');
  console.log(`**${home.team.abbreviation}:**`);
  console.log(`✅ Team Stats: NBA API (Real)`);
  console.log(`✅ Player Stats: NBA API (Real)`);
  console.log(`${home.pdfEnhanced ? '✅' : '⚠️'}  Injury Data: ${home.injuryDataSource}${home.pdfEnhanced ? ' (PDF Enhanced)' : ''}`);
  console.log('');
  
  console.log('## TEAM STATISTICS (Last 5 Games)');
  console.log('');
  generateTeamComparison(away, home);
  
  console.log('\n## INJURY REPORT');
  console.log('');
  generateInjuryReport(away, home);
  
  // NEW: Generate game script analysis for strategic insights
  const gameScript = generateGameScriptAnalysis(away, home, away.teamStyle, home.teamStyle);
  displayGameScriptAnalysis(gameScript, away.team, home.team);
  
  console.log(`\n## ${away.team.abbreviation} PROJECTED STATS`);
  console.log('');
  generateEnhancedPlayerProjections(away.players, away.team.abbreviation, game.date, {
    teamStyle: away.teamStyle,
    lineups: away.lineups,
    opponentStyle: home.teamStyle,
    opponentLineups: home.lineups,
    injuries: away.injuries,
    isHome: false
  }, gameScript);
  
  console.log(`\n## ${home.team.abbreviation} PROJECTED STATS`);
  console.log('');
  generateEnhancedPlayerProjections(home.players, home.team.abbreviation, game.date, {
    teamStyle: home.teamStyle,
    lineups: home.lineups,
    opponentStyle: away.teamStyle,
    opponentLineups: away.lineups,
    injuries: home.injuries,
    isHome: true
  }, gameScript);
  
  console.log('\n## GAME PREDICTION');
  console.log('');
  const prediction = generatePrediction(away, home);
  
  addGameToCsv(game, away, home, prediction);
}

function generateTeamComparison(away, home) {
  const awayStats = away.stats?.general || {};
  const homeStats = home.stats?.general || {};
  const awayAdv = away.stats?.advanced || {};
  const homeAdv = home.stats?.advanced || {};
  
  const rows = [
    ['Stat', away.team.abbreviation, home.team.abbreviation],
    ['Record', `${awayStats.wins || 0}-${awayStats.losses || 0}`, `${homeStats.wins || 0}-${homeStats.losses || 0}`],
    ['Points Per Game', awayStats.points || 'N/A', homeStats.points || 'N/A'],
    ['Off Rating', awayAdv.offensiveRating?.toFixed(1) || 'N/A', homeAdv.offensiveRating?.toFixed(1) || 'N/A'],
    ['Def Rating', awayAdv.defensiveRating?.toFixed(1) || 'N/A', homeAdv.defensiveRating?.toFixed(1) || 'N/A'],
    ['Pace', awayAdv.pace?.toFixed(1) || 'N/A', homeAdv.pace?.toFixed(1) || 'N/A'],
    ['FG%', `${((awayStats.fieldGoalPct || 0) * 100).toFixed(1)}%`, `${((homeStats.fieldGoalPct || 0) * 100).toFixed(1)}%`],
    ['3P%', `${((awayStats.threePointPct || 0) * 100).toFixed(1)}%`, `${((homeStats.threePointPct || 0) * 100).toFixed(1)}%`],
    ['Rebounds', awayStats.rebounds || 'N/A', homeStats.rebounds || 'N/A'],
    ['Assists', awayStats.assists || 'N/A', homeStats.assists || 'N/A']
  ];
  
  drawBoxTable(rows, [20, 8, 8]);
}

function generateInjuryReport(away, home) {
  console.log(`**${away.team.abbreviation} Injuries:**`);
  if (away.injuries.length === 0) {
    console.log('- No injuries reported');
  } else {
    away.injuries.forEach(inj => {
      const statusIcon = inj.status === 'out' ? '❌' : inj.status === 'doubtful' ? '⚠️' : '❓';
      const source = inj.source ? ` [${inj.source}]` : '';
      console.log(`${statusIcon} ${inj.playerName} - ${inj.status} - ${inj.description || 'No details'}${source}`);
    });
  }
  
  console.log('');
  console.log(`**${home.team.abbreviation} Injuries:**`);
  if (home.injuries.length === 0) {
    console.log('- No injuries reported');
  } else {
    home.injuries.forEach(inj => {
      const statusIcon = inj.status === 'out' ? '❌' : inj.status === 'doubtful' ? '⚠️' : '❓';
      const source = inj.source ? ` [${inj.source}]` : '';
      console.log(`${statusIcon} ${inj.playerName} - ${inj.status} - ${inj.description || 'No details'}${source}`);
    });
  }
}

/**
 * NEW: Enhanced player projections integrating team style, lineup data, and game script analysis
 */
function generateEnhancedPlayerProjections(players, teamAbbr, gameDate, enhancementContext, gameScript = null) {
  // FIXED: Filter out players who are OUT before projections
  const availablePlayers = players.filter(player => {
    // Check if player is OUT due to injury
    const outInjury = enhancementContext.injuries?.find(injury => 
      playersMatch(player.playerName, injury.playerName) && injury.status === 'out'
    );
    
    if (outInjury) {
      console.log(`🚫 ${player.playerName} excluded from projections (${outInjury.status}: ${outInjury.description})`);
      return false;
    }
    
    return true;
  });
  
  const topPlayers = availablePlayers
    .filter(p => p.minutes > 5)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 9);
  
  if (topPlayers.length === 0) {
    console.log('*No player data available*');
    return;
  }
  
  const rows = [
    ['Player', 'Pos', 'Points', 'Reb', 'Ast', 'Stl', 'Blk', '3PM', 'FG%', 'Min', 'Usage%', 'Inj', 'Star', 'Enh', 'GS']
  ];
  
  let enhancementNotes = [];
  let gameScriptNotes = [];
  
  // Apply game script analysis to players if available
  const playersWithGameScript = gameScript ? 
    applyGameScriptToProjections(topPlayers, gameScript, teamAbbr) : 
    topPlayers.map(p => ({ ...p, gameScriptBoost: 0, gameScriptReasons: [] }));
  
  playersWithGameScript.forEach((player, idx) => {
    const pos = getPlayerPosition(player, idx);
    
    // Start with base projections
    let enhancedPoints = player.points;
    let enhancedAssists = player.assists;
    let enhancedRebounds = player.rebounds;
    let enhancedThreePointers = player.threePointersMade;
    
    // Apply three types of enhancements (existing system)
    const enhancements = applyPlayerEnhancements(player, enhancementContext, idx);
    enhancedPoints += enhancements.pointsBoost;
    enhancedAssists += enhancements.assistsBoost;
    enhancedRebounds += enhancements.reboundsBoost;
    enhancedThreePointers += enhancements.threePoinersBoost;
    
    // NEW: Apply game script boosts
    enhancedPoints += player.gameScriptBoost || 0;
    
    // Track significant enhancements for notes
    if (enhancements.totalBoost > 1) {
      enhancementNotes.push({
        player: player.playerName,
        boost: enhancements.totalBoost,
        reasons: enhancements.reasons
      });
    }
    
    // Track game script impacts
    if (player.gameScriptBoost > 0.5) {
      gameScriptNotes.push({
        player: player.playerName,
        boost: player.gameScriptBoost,
        reasons: player.gameScriptReasons
      });
    }
    
    // Format enhanced projections
    const points = formatRange(enhancedPoints, 4);
    const reb = formatRange(enhancedRebounds, 1);
    const ast = formatRange(enhancedAssists, 1);
    const stl = formatRange(player.steals, 0.5);
    const blk = formatRange(player.blocks, 0.5);
    const tpm = formatRange(enhancedThreePointers, 0.5);
    const fgPct = `${(player.fieldGoalPct * 100).toFixed(0)}%`;
    const min = formatRange(player.minutes, 2);
    const usage = player.advanced?.usageRate 
      ? `${(player.advanced.usageRate * 100).toFixed(0)}%`
      : 'N/A';
    
    // Create clean Y/N indicator columns
    const injuryStatus = player.injuryAdjusted ? 'Y' : 'N';
    const impact = player.impact?.tier || '';
    const starStatus = (impact === 'Superstar' || impact === 'Star') ? 'Y' : 'N';
    const enhancementStatus = enhancements.totalBoost > 1 ? 'Y' : 'N';
    const gameScriptStatus = player.gameScriptBoost > 0.5 ? 'Y' : 'N';
    
    rows.push([
      truncate(player.playerName, 20),
      pos,
      points,
      reb,
      ast,
      stl,
      blk,
      tpm,
      fgPct,
      min,
      usage,
      injuryStatus,
      starStatus,
      enhancementStatus,
      gameScriptStatus
    ]);
  });
  
  drawBoxTable(rows, [22, 4, 8, 5, 5, 5, 5, 5, 6, 7, 8, 4, 5, 4, 3]);
  
  console.log('');
  
  // Show injury adjustments
  if (topPlayers.some(p => p.injuryAdjusted)) {
    console.log('**Injury Adjustments Applied:**');
    topPlayers.filter(p => p.injuryAdjusted).forEach(p => {
      console.log(`- ${p.playerName}: ${p.injuryAdjusted}`);
    });
    console.log('');
  }
  
  // NEW: Show uncertainty adjustments for questionable players (more prominent)
  const uncertainPlayers = topPlayers.filter(p => p.uncertainty > 0);
  if (uncertainPlayers.length > 0) {
    console.log('**🎲 UNCERTAINTY ADJUSTMENTS (Probability-Weighted):**');
    uncertainPlayers.forEach(p => {
      const playProb = Math.round((1 - p.uncertainty) * 100);
      const statusEmoji = playProb >= 85 ? '✅' : playProb >= 60 ? '❓' : '⚠️';
      console.log(`${statusEmoji} ${p.playerName}: ${playProb}% chance to play - projections reduced accordingly`);
      if (playProb < 85) {
        console.log(`   💡 If ${p.playerName} sits: Teammates get enhanced opportunity boosts`);
      }
    });
    console.log('');
  }
  
  // Show enhancement details
  if (enhancementNotes.length > 0) {
    console.log('**🔥 Enhanced Projections Applied:**');
    enhancementNotes.forEach(note => {
      console.log(`- ${note.player}: +${note.boost.toFixed(1)} boost (${note.reasons.join(', ')})`);
    });
    console.log('');
  }
  
  // NEW: Show game script impacts
  if (gameScriptNotes.length > 0) {
    console.log('**⚔️ Game Script Impacts:**');
    gameScriptNotes.forEach(note => {
      console.log(`- ${note.player}: +${note.boost.toFixed(1)} strategic boost (${note.reasons.join(', ')})`);
    });
    console.log('');
  }
  
  console.log('**Notes:**');
  console.log(`- Projections weighted toward recent ${Math.min(3, topPlayers[0]?.gamesPlayed || 0)} games`);
  console.log('- Inj = Injury adjustment | Star = Superstar/Star player | Enh = Enhanced projection | GS = Game script boost');
  console.log('- Y/N indicators show: Y = Applied, N = Not applied');
  console.log('- Uncertainty info: See "🎲 UNCERTAINTY ADJUSTMENTS" section above for probability details');
  console.log('- Enhanced projections use team style + lineup intelligence + game script analysis + injury uncertainty');
  console.log('- Ranges show uncertainty (e.g., 35-40 points)');
}

/**
 * Apply three types of player enhancements based on team style and lineup data
 */
function applyPlayerEnhancements(player, context, playerIndex) {
  let pointsBoost = 0;
  let assistsBoost = 0;
  let reboundsBoost = 0;
  let threePoinersBoost = 0;
  let reasons = [];
  
  const { teamStyle, lineups, opponentStyle, opponentLineups, isHome } = context;
  
  // ENHANCEMENT 1: Team Style Multipliers
  if (teamStyle.success && teamStyle.profile && opponentStyle.success && opponentStyle.profile) {
    const myStyle = teamStyle.profile;
    const oppStyle = opponentStyle.profile;
    
    // Pace advantage boost (when data available)
    if (myStyle.offensiveStyle?.pace && oppStyle.offensiveStyle?.pace) {
      const paceAdvantage = myStyle.offensiveStyle.pace - oppStyle.offensiveStyle.pace;
      if (paceAdvantage > 3) {
        // Fast pace benefits guards and ball handlers more
        if (playerIndex <= 2) { // Top 3 players typically guards/wings
          pointsBoost += 1;
          assistsBoost += 0.3;
          reasons.push('pace advantage');
        }
      }
    }
    
    // Three-point shooting advantage
    if (myStyle.offensiveStyle?.shotSelection && oppStyle.defensiveStyle) {
      const myThreeRate = myStyle.offensiveStyle.shotSelection.threePointRate;
      const oppThreeDefense = oppStyle.defensiveStyle.opponentThreePointPct || 0.36;
      
      // If team shoots lots of threes AND opponent allows high 3P%
      if (myThreeRate > 0.40 && oppThreeDefense > 0.37) {
        // Boost three-point shooters
        if (player.threePointersMade > 1.5) {
          threePoinersBoost += 0.5;
          pointsBoost += 1.5; // 3 points per additional three
          reasons.push('3PT advantage');
        }
      }
    }
    
    // Ball movement advantage
    if (myStyle.offensiveStyle?.ballMovement && oppStyle.defensiveStyle) {
      const myAssistRate = myStyle.offensiveStyle.ballMovement.assistRate;
      if (myAssistRate > 0.60) {
        // Boost primary playmakers in ball movement systems
        if (playerIndex <= 1 && player.assists > 3) {
          assistsBoost += 0.8;
          pointsBoost += 0.5;
          reasons.push('ball movement system');
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
        pointsBoost += 1;
        assistsBoost += 0.2;
        reboundsBoost += 0.3;
        reasons.push('dominant lineup');
      }
    }
    
    // High-confidence rotation boost
    if (rotation.confidence > 0.90) {
      // Players with defined roles get consistency boost
      if (playerIndex < 7) {
        pointsBoost += 0.5;
        reasons.push('stable rotation');
      }
    }
  }
  
  // ENHANCEMENT 3: Matchup-Specific Adjustments
  
  // Home court advantage (slight boost for role players)
  if (isHome && playerIndex > 2) {
    pointsBoost += 0.5;
    reboundsBoost += 0.2;
    reasons.push('home court');
  }
  
  // Star player advantages in favorable matchups
  const impact = player.impact?.tier;
  if (impact === 'Superstar' || impact === 'Star') {
    // Stars typically benefit more from any team advantages
    pointsBoost *= 1.2;
    assistsBoost *= 1.3;
    if (reasons.length > 0) {
      reasons.push('star multiplier');
    }
  }
  
  const totalBoost = pointsBoost + (assistsBoost * 2) + reboundsBoost + (threePoinersBoost * 3);
  
  return {
    pointsBoost,
    assistsBoost,
    reboundsBoost,
    threePoinersBoost,
    totalBoost,
    reasons
  };
}

function generatePlayerProjections(players, teamAbbr, gameDate) {
  const topPlayers = players
    .filter(p => p.minutes > 5)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 9);
  
  if (topPlayers.length === 0) {
    console.log('*No player data available*');
    return;
  }
  
  const rows = [
    ['Player', 'Pos', 'Points', 'Reb', 'Ast', 'Stl', 'Blk', '3PM', 'FG%', 'Min', 'Usage%']
  ];
  
  topPlayers.forEach((player, idx) => {
    const pos = getPlayerPosition(player, idx);
    const points = formatRange(player.points, 4);
    const reb = formatRange(player.rebounds, 1);
    const ast = formatRange(player.assists, 1);
    const stl = formatRange(player.steals, 0.5);
    const blk = formatRange(player.blocks, 0.5);
    const tpm = formatRange(player.threePointersMade, 0.5);
    const fgPct = `${(player.fieldGoalPct * 100).toFixed(0)}%`;
    const min = formatRange(player.minutes, 2);
    const usage = player.advanced?.usageRate 
      ? `${(player.advanced.usageRate * 100).toFixed(0)}%`
      : 'N/A';
    
    // Add injury indicator
    const injuryMark = player.injuryAdjusted ? ' 🏥' : '';
    const impact = player.impact?.tier || '';
    const impactMark = impact === 'Superstar' ? ' ⭐' : impact === 'Star' ? ' ✨' : '';
    
    rows.push([
      truncate(player.playerName + injuryMark + impactMark, 20),
      pos,
      points,
      reb,
      ast,
      stl,
      blk,
      tpm,
      fgPct,
      min,
      usage
    ]);
  });
  
  drawBoxTable(rows, [22, 4, 8, 5, 5, 5, 5, 5, 6, 7, 8]);
  
  console.log('');
  if (topPlayers.some(p => p.injuryAdjusted)) {
    console.log('**Injury Adjustments Applied:**');
    topPlayers.filter(p => p.injuryAdjusted).forEach(p => {
      console.log(`- ${p.playerName}: ${p.injuryAdjusted}`);
    });
    console.log('');
  }
  console.log('**Notes:**');
  console.log(`- Projections weighted toward recent ${Math.min(3, topPlayers[0]?.gamesPlayed || 0)} games`);
  console.log('- 🏥 = Injury adjustment applied | ⭐ = Superstar | ✨ = Star');
  console.log('- Ranges show uncertainty (e.g., 35-40 points)');
}

/**
 * Generate enhanced prediction with confidence breakdown
 */
function generatePrediction(away, home) {
  const awayAdv = away.stats?.advanced || {};
  const homeAdv = home.stats?.advanced || {};
  const awayStats = away.stats?.general || {};
  const homeStats = home.stats?.general || {};
  
  // NEW: Calculate dynamic home court advantage based on actual records
  const dynamicHomeAdvantage = calculateDynamicHomeAdvantage(homeStats, awayStats);
  
  // NEW: Calculate team strength differential with record weighting
  const teamStrengthDiff = calculateTeamStrengthDifferential(home, away, homeStats, awayStats);
  
  // NEW: Calculate sophisticated pace using all available data layers
  const paceAnalysis = calculateSophisticatedPace(away, home, {
    // Add contextual factors when needed
    // backToBack: isBackToBack(away, home),
    // overtimeLikely: isCloseMatchup(away, home)
  });
  
  // Calculate predicted scores with sophisticated pace
  const awayPredicted = calculatePredictedScore(awayAdv, homeAdv, false, 0, teamStrengthDiff, paceAnalysis.base);
  const homePredicted = calculatePredictedScore(homeAdv, awayAdv, true, dynamicHomeAdvantage, teamStrengthDiff, paceAnalysis.base);
  
  // Calculate uncertainty range
  const awayRange = calculateUncertaintyRange(awayPredicted, away);
  const homeRange = calculateUncertaintyRange(homePredicted, home);
  
  // Calculate win probability
  const margin = awayPredicted - homePredicted;
  const awayWinProb = calculateWinProbability(margin);
  
  console.log(`**Predicted Score:**`);
  console.log(`${away.team.name}: ${awayRange.low}-${awayRange.high} (${awayPredicted})`);
  console.log(`${home.team.name}: ${homeRange.low}-${homeRange.high} (${homePredicted})`);
  console.log('');
  
  console.log(`**Win Probability:**`);
  const awayProbPct = (awayWinProb * 100).toFixed(0);
  const homeProbPct = ((1 - awayWinProb) * 100).toFixed(0);
  const awayBar = '█'.repeat(Math.round(awayWinProb * 20));
  const homeBar = '█'.repeat(Math.round((1 - awayWinProb) * 20));
  console.log(`${away.team.abbreviation}: ${awayProbPct}% ${awayBar}${'░'.repeat(20 - awayBar.length)}`);
  console.log(`${home.team.abbreviation}: ${homeProbPct}% ${homeBar}${'░'.repeat(20 - homeBar.length)}`);
  console.log('');
  
  const absMargin = Math.abs(margin);
  const favorite = margin > 0 ? away.team.name : home.team.name;
  
  console.log(`**Analysis:**`);
  console.log(`- ${favorite} favored by ${absMargin.toFixed(1)} points`);
  
  // NEW: Enhanced pace display with breakdown
  console.log(`- Pace: ${paceAnalysis.base.toFixed(1)} possessions (${paceAnalysis.confidence} confidence)`);
  if (paceAnalysis.breakdown.length > 0) {
    console.log(`  └─ Calculation: ${paceAnalysis.breakdown.join(' + ')}`);
  }
  
  console.log(`- Projected Total: ${(awayPredicted + homePredicted).toFixed(1)} points`);
  
  // Enhanced confidence calculation
  const confidence = calculateEnhancedConfidence(away, home, margin);
  
  console.log('');
  console.log(`**Confidence: ${'★'.repeat(confidence.stars)}${'☆'.repeat(5 - confidence.stars)} (${confidence.stars}/5 - ${confidence.level})**`);
  console.log('');
  console.log('**Confidence Factors:**');
  confidence.factors.forEach(factor => {
    console.log(`${factor.icon} ${factor.text}`);
  });
  
  return {
    awayScore: awayPredicted,
    homeScore: homePredicted,
    awayRange: `${awayRange.low}-${awayRange.high}`,
    homeRange: `${homeRange.low}-${homeRange.high}`,
    margin: absMargin,
    favorite,
    awayWinProb: (awayWinProb * 100).toFixed(1),
    homeWinProb: ((1 - awayWinProb) * 100).toFixed(1),
    confidence: confidence.stars,
    confidenceLevel: confidence.level,
    pace: paceAnalysis.base,
    paceBreakdown: paceAnalysis.breakdown,
    paceConfidence: paceAnalysis.confidence
  };
}

/**
 * Calculate enhanced confidence based on multiple factors
 */
function calculateEnhancedConfidence(away, home, margin) {
  let score = 0;
  const factors = [];
  
  // Factor 1: Sample size (0-2 points)
  const avgGames = ((away.stats?.general?.gamesPlayed || 0) + (home.stats?.general?.gamesPlayed || 0)) / 2;
  if (avgGames >= 10) {
    score += 2;
    factors.push({ icon: '✅', text: `Good sample size (${avgGames.toFixed(0)} games avg)` });
  } else if (avgGames >= 5) {
    score += 1;
    factors.push({ icon: '⚠️', text: 'Moderate sample size (5-9 games)' });
  } else {
    factors.push({ icon: '❌', text: 'Limited sample size (< 5 games) - high uncertainty' });
  }
  
  // Factor 2: Injury impact (0-1 point)
  const totalInjuries = away.injuries.length + home.injuries.length;
  if (totalInjuries === 0) {
    score += 1;
    factors.push({ icon: '✅', text: 'No significant injuries' });
  } else if (totalInjuries <= 2) {
    score += 0.5;
    factors.push({ icon: '⚠️', text: `${totalInjuries} injured player(s) - moderate uncertainty` });
  } else {
    factors.push({ icon: '❌', text: `${totalInjuries} injured players - high uncertainty` });
  }
  
  // Factor 3: Statistical certainty (0-2 points)
  const absMargin = Math.abs(margin);
  if (absMargin >= 12) {
    score += 2;
    factors.push({ icon: '✅', text: 'Large predicted margin (high certainty)' });
  } else if (absMargin >= 6) {
    score += 1;
    factors.push({ icon: '⚠️', text: 'Moderate predicted margin' });
  } else {
    factors.push({ icon: '❌', text: 'Close matchup predicted (higher variance)' });
  }
  
  // Factor 4: Data quality
  const pdfEnhanced = away.pdfEnhanced || home.pdfEnhanced;
  if (pdfEnhanced) {
    score += 0.5;
    factors.push({ icon: '✅', text: 'Enhanced with PDF injury data' });
  }
  
  // Convert score to stars (0-5 scale)
  const stars = Math.min(5, Math.max(1, Math.round(score)));
  
  let level;
  if (stars >= 4) level = 'High';
  else if (stars >= 3) level = 'Medium';
  else level = 'Low';
  
  return { stars, level, factors };
}

/**
 * Calculate uncertainty range based on team consistency
 */
function calculateUncertaintyRange(predictedScore, teamData) {
  const gamesPlayed = teamData.stats?.general?.gamesPlayed || 1;
  
  // More games = narrower range
  let rangeFactor = 8; // Base uncertainty
  if (gamesPlayed >= 10) rangeFactor = 4;
  else if (gamesPlayed >= 5) rangeFactor = 6;
  
  return {
    low: Math.max(0, Math.round(predictedScore - rangeFactor)),
    high: Math.round(predictedScore + rangeFactor)
  };
}

/**
 * Calculate win probability using logistic regression
 */
function calculateWinProbability(marginDiff) {
  // Convert point differential to win probability
  // Based on NBA historical data
  return 1 / (1 + Math.exp(-marginDiff * 0.15));
}

/**
 * NEW: Generate game script analysis - Phase 1: Statistical Mismatch Detection
 */
function generateGameScriptAnalysis(awayData, homeData, awayStyle, homeStyle) {
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
  
  if (Math.abs(paintDifferential) > 5) {
    const advantageTeam = paintDifferential > 0 ? awayData.team.abbreviation : homeData.team.abbreviation;
    const disadvantageTeam = paintDifferential > 0 ? homeData.team.abbreviation : awayData.team.abbreviation;
    
    gameScript.keyBattles.push({
      type: "Interior Battle",
      advantage: advantageTeam,
      differential: Math.abs(paintDifferential).toFixed(1),
      confidence: Math.abs(paintDifferential) > 7 ? "High" : "Medium"
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
  
  if (paceDifferential > 4) {
    const fasterTeam = awayPace > homePace ? awayData.team.abbreviation : homeData.team.abbreviation;
    const slowerTeam = awayPace < homePace ? awayData.team.abbreviation : homeData.team.abbreviation;
    
    gameScript.keyBattles.push({
      type: "Tempo Control",
      advantage: fasterTeam,
      differential: paceDifferential.toFixed(1),
      confidence: paceDifferential > 6 ? "High" : "Medium"
    });
    
    gameScript.strategicInsights.push(`${fasterTeam} should push pace in transition - ${paceDifferential.toFixed(1)} possession advantage per game`);
    gameScript.predictedApproaches.push(`Pace battle will be decisive: ${fasterTeam} pushes vs ${slowerTeam} controls`);
  }
  
  // MISMATCH 3: Three-Point Shooting vs Defense
  const awayThreeRate = (awayStats.threePointersMade / awayStats.fieldGoalsAttempted) || 0;
  const homeThreeDefense = homeStats.oppThreePointPct || 0.36;
  const threePointAdvantage = awayThreeRate - homeThreeDefense;
  
  if (Math.abs(threePointAdvantage) > 0.04) { // 4% differential is significant
    const advantageTeam = threePointAdvantage > 0 ? awayData.team.abbreviation : homeData.team.abbreviation;
    
    gameScript.keyBattles.push({
      type: "Perimeter Shooting",
      advantage: advantageTeam,
      differential: `${(Math.abs(threePointAdvantage) * 100).toFixed(1)}%`,
      confidence: Math.abs(threePointAdvantage) > 0.06 ? "High" : "Medium"
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
 * Display game script analysis with strategic insights
 */
function displayGameScriptAnalysis(gameScript, awayTeam, homeTeam) {
  // Capture for CSV export
  gameScriptAnalysisData = {
    keyBattles: gameScript.keyBattles,
    awayStrategy: '',
    homeStrategy: '',
    confidence: gameScript.confidence
  };
  
  if (gameScript.keyBattles.length === 0) {
    console.log('\n🧠 GAME SCRIPT ANALYSIS');
    console.log('─'.repeat(50));
    console.log('• No significant statistical mismatches detected');
    console.log('• Expect balanced tactical approach from both teams');
    return;
  }
  
  console.log('\n🧠 GAME SCRIPT ANALYSIS');
  console.log('─'.repeat(50));
  
  // Display key battles
  console.log('\n⚔️ Key Strategic Battles:');
  gameScript.keyBattles.forEach(battle => {
    const confidenceIcon = battle.confidence === "High" ? "🔥" : "📊";
    console.log(`${confidenceIcon} ${battle.type}: ${battle.advantage} advantage (${battle.differential})`);
  });
  
  // Display strategic insights
  if (gameScript.strategicInsights.length > 0) {
    console.log('\n🎯 Strategic Recommendations:');
    gameScript.strategicInsights.forEach((insight, idx) => {
      console.log(`• ${insight}`);
      
      // Capture strategy recommendations for CSV
      if (insight.includes(awayTeam.abbreviation)) {
        gameScriptAnalysisData.awayStrategy += insight + '; ';
      }
      if (insight.includes(homeTeam.abbreviation)) {
        gameScriptAnalysisData.homeStrategy += insight + '; ';
      }
    });
  }
  
  // Display predicted approaches
  if (gameScript.predictedApproaches.length > 0) {
    console.log('\n🏀 Predicted Game Flow:');
    gameScript.predictedApproaches.forEach(approach => {
      console.log(`• ${approach}`);
    });
  }
  
  console.log(`\n📈 Analysis Confidence: ${gameScript.confidence} (Phase 1: Statistical mismatch detection)`);
  console.log('💡 Strategic insights based on clear statistical differentials (5+ point advantages)');
}

/**
 * Apply game script insights to player projections
 */
function applyGameScriptToProjections(players, gameScript, teamAbbr) {
  return players.map(player => {
    let scriptBoost = 0;
    let scriptReasons = [];
    
    // Apply paint advantage to interior players
    const paintAdvantage = gameScript.keyBattles.find(battle => 
      battle.type === "Interior Battle" && battle.advantage === teamAbbr
    );
    if (paintAdvantage && (player.position === 'C' || player.position === 'PF')) {
      const boost = paintAdvantage.confidence === "High" ? 2.0 : 1.0;
      scriptBoost += boost;
      scriptReasons.push(`paint advantage (+${boost.toFixed(1)})`);
    }
    
    // Apply pace advantage to guards and wings
    const paceAdvantage = gameScript.keyBattles.find(battle => 
      battle.type === "Tempo Control" && battle.advantage === teamAbbr
    );
    if (paceAdvantage && (player.position === 'PG' || player.position === 'SG' || player.position === 'SF')) {
      const boost = paceAdvantage.confidence === "High" ? 1.5 : 0.8;
      scriptBoost += boost;
      scriptReasons.push(`pace advantage (+${boost.toFixed(1)})`);
    }
    
    // Apply three-point advantage to perimeter players
    const threeAdvantage = gameScript.keyBattles.find(battle => 
      battle.type === "Perimeter Shooting" && battle.advantage === teamAbbr
    );
    if (threeAdvantage && player.threePointersMade > 1.0) {
      const boost = threeAdvantage.confidence === "High" ? 1.2 : 0.6;
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
function calculateSophisticatedPace(awayData, homeData, context = {}) {
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
 * Calculate predicted score with ratings and pace
 */
function calculatePredictedScore(teamAdv, oppAdv, isHome, homeAdvantage, teamStrengthDiff, sophisticatedPace = null) {
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
  
  return Math.round(baseScore);
}

// Utility functions from working analyzer
function drawBoxTable(rows, columnWidths) {
  const topBorder = '┌' + columnWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const middleBorder = '├' + columnWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottomBorder = '└' + columnWidths.map(w => '─'.repeat(w)).join('┴') + '┘';
  
  console.log(topBorder);
  
  rows.forEach((row, idx) => {
    const cells = row.map((cell, i) => {
      const str = String(cell);
      return str.padEnd(columnWidths[i] - 1) + ' ';
    });
    console.log('│' + cells.join('│') + '│');
    
    if (idx === 0) {
      console.log(middleBorder);
    }
  });
  
  console.log(bottomBorder);
}

function getPlayerPosition(player, index) {
  // First, check if we have actual position data from the API
  if (player.position) {
    // Map NBA's broader position categories to specific positions for game script logic
    return mapNBAPosition(player.position, player, index);
  }
  
  // Enhanced position guessing logic based on stats
  const ast = player.assists || 0;
  const reb = player.rebounds || 0;
  const blk = player.blocks || 0;
  const tpm = player.threePointersMade || 0;
  
  // Point guard indicators: high assists, first in rotation
  if (index === 0 && ast > 4) return 'PG';
  if (ast > 6) return 'PG';
  
  // Center indicators: high rebounds + blocks, low threes
  if (reb > 8 && blk > 0.8) return 'C';
  if (reb > 9) return 'C';
  
  // Power forward indicators: good rebounds, some blocks
  if (reb > 6 && reb <= 9) return 'PF';
  if (reb > 5 && blk > 0.5) return 'PF';
  
  // Shooting guard indicators: moderate assists, good threes
  if (index === 1 && ast > 2 && tpm > 1) return 'SG';
  if (ast > 3 && ast < 6 && tpm > 2) return 'SG';
  
  // Small forward fallback for wing players
  if (index <= 2 && tpm > 1) return 'SF';
  
  // Default position based on roster order
  if (index === 0) return 'PG';
  if (index === 1) return 'SG';
  if (index <= 3) return 'SF';
  if (index === 4) return 'PF';
  return 'C';
}

/**
 * NEW: Map NBA's broad position categories to specific positions for game script logic
 */
function mapNBAPosition(nbaPosition, player, index) {
  const ast = player.assists || 0;
  const reb = player.rebounds || 0;
  const blk = player.blocks || 0;
  const tpm = player.threePointersMade || 0;
  
  // Handle compound positions
  if (nbaPosition.includes('-')) {
    const positions = nbaPosition.split('-');
    // Use primary position (first one) and refine
    nbaPosition = positions[0];
  }
  
  switch (nbaPosition.toUpperCase()) {
    case 'C':
      return 'C'; // Center is specific enough
      
    case 'F':
      // Forward - need to determine PF vs SF
      if (reb > 7 || blk > 0.8) {
        return 'PF'; // Power forward indicators
      } else {
        return 'SF'; // Small forward default
      }
      
    case 'G':
      // Guard - need to determine PG vs SG
      if (ast > 5 || index === 0) {
        return 'PG'; // Point guard indicators
      } else {
        return 'SG'; // Shooting guard default
      }
      
    case 'PG':
    case 'SG': 
    case 'SF':
    case 'PF':
      return nbaPosition.toUpperCase(); // Already specific
      
    default:
      // Fallback to statistical analysis
      console.warn(`Unknown NBA position: ${nbaPosition} for ${player.playerName}`);
      return getStatisticalPosition(player, index);
  }
}

/**
 * NEW: Helper function for statistical position analysis when NBA position is unclear
 */
function getStatisticalPosition(player, index) {
  const ast = player.assists || 0;
  const reb = player.rebounds || 0;
  const blk = player.blocks || 0;
  const tpm = player.threePointersMade || 0;
  
  // Use the same logic as the fallback in getPlayerPosition
  if (index === 0 && ast > 4) return 'PG';
  if (ast > 6) return 'PG';
  if (reb > 8 && blk > 0.8) return 'C';
  if (reb > 9) return 'C';
  if (reb > 6 && reb <= 9) return 'PF';
  if (reb > 5 && blk > 0.5) return 'PF';
  if (index === 1 && ast > 2 && tpm > 1) return 'SG';
  if (ast > 3 && ast < 6 && tpm > 2) return 'SG';
  if (index <= 2 && tpm > 1) return 'SF';
  
  // Roster order fallback
  if (index === 0) return 'PG';
  if (index === 1) return 'SG';  
  if (index <= 3) return 'SF';
  if (index === 4) return 'PF';
  return 'C';
}

function formatRange(value, variance) {
  if (!value || value === 0) return '0';
  const low = Math.max(0, Math.round(value - variance));
  const high = Math.round(value + variance);
  return low === high ? `${low}` : `${low}-${high}`;
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '.';
}

/**
 * Add game data to CSV collection with enhanced Google Sheets formatting
 */
function addGameToCsv(game, away, home, prediction) {
  const timestamp = new Date().toISOString();
  const gameDate = game.date.split('T')[0];
  
  // GAME SUMMARY - Clean structure for Google Sheets analysis
  gameData.push({
    Date: gameDate,
    Time: game.time,
    Away: away.team.abbreviation,
    Home: home.team.abbreviation,
    Matchup: `${away.team.abbreviation} @ ${home.team.abbreviation}`,
    
    // Predictions (clean numbers for formulas)
    AwayScore: prediction.awayScore,
    HomeScore: prediction.homeScore,
    Total: prediction.awayScore + prediction.homeScore,
    Margin: prediction.margin.toFixed(1),
    Favorite: prediction.favorite,
    
    // Win Probabilities (clean percentages)
    AwayWinPct: parseFloat(prediction.awayWinProb),
    HomeWinPct: parseFloat(prediction.homeWinProb),
    
    // Enhanced Analysis
    Pace: prediction.pace || 'N/A',
    PaceConfidence: prediction.paceConfidence || 'N/A',
    Confidence: prediction.confidenceLevel,
    
    // Team Stats
    AwayRecord: `${away.stats?.general?.wins || 0}-${away.stats?.general?.losses || 0}`,
    HomeRecord: `${home.stats?.general?.wins || 0}-${home.stats?.general?.losses || 0}`,
    AwayOffRtg: away.stats?.advanced?.offensiveRating?.toFixed(1) || '',
    HomeOffRtg: home.stats?.advanced?.offensiveRating?.toFixed(1) || '',
    AwayDefRtg: away.stats?.advanced?.defensiveRating?.toFixed(1) || '',
    HomeDefRtg: home.stats?.advanced?.defensiveRating?.toFixed(1) || '',
    
    // Injury Impact
    AwayInjuries: away.injuries.length,
    HomeInjuries: home.injuries.length,
    
    // Data Quality
    DataSource: away.pdfEnhanced ? 'Enhanced' : 'Standard',
    LastUpdated: timestamp
  });
  
  // PLAYER PROJECTIONS - Separate sheet with enhanced data
  const awayPlayers = away.players.filter(p => p.minutes > 5).sort((a, b) => b.minutes - a.minutes).slice(0, 9);
  const homePlayers = home.players.filter(p => p.minutes > 5).sort((a, b) => b.minutes - a.minutes).slice(0, 9);
  
  [...awayPlayers, ...homePlayers].forEach((player, idx) => {
    const position = getPlayerPosition(player, idx);
    
    // Enhanced projections calculation for CSV
    const enhancedProjections = calculatePlayerEnhancementsForCsv(player, 
      player.teamAbbreviation === away.team.abbreviation ? away : home, 
      player.teamAbbreviation === away.team.abbreviation ? home : away);
    
    playerData.push({
      Date: gameDate,
      Matchup: `${away.team.abbreviation} @ ${home.team.abbreviation}`,
      Team: player.teamAbbreviation,
      Player: player.playerName,
      Pos: position,
      
      // Base Projections (clean numbers)
      BasePoints: player.points?.toFixed(1) || '0',
      BaseBounds: player.rebounds?.toFixed(1) || '0', 
      BaseAssists: player.assists?.toFixed(1) || '0',
      BaseSteals: player.steals?.toFixed(1) || '0',
      BaseBlocks: player.blocks?.toFixed(1) || '0',
      Base3PM: player.threePointersMade?.toFixed(1) || '0',
      BaseMinutes: player.minutes?.toFixed(1) || '0',
      
      // Enhanced Projections (with all boosts applied)
      EnhPoints: enhancedProjections.points?.toFixed(1) || '0',
      EnhRebounds: enhancedProjections.rebounds?.toFixed(1) || '0',
      EnhAssists: enhancedProjections.assists?.toFixed(1) || '0',
      EnhMinutes: enhancedProjections.minutes?.toFixed(1) || '0',
      
      // Enhancement Analysis
      PointsBoost: enhancedProjections.pointsBoost?.toFixed(1) || '0',
      HasInjuryAdj: player.injuryAdjusted ? 'Y' : 'N',
      HasEnhancement: enhancedProjections.totalBoost > 1 ? 'Y' : 'N',
      HasGameScript: enhancedProjections.gameScriptBoost > 0.5 ? 'Y' : 'N',
      
      // Player Context  
      StarTier: player.impact?.tier || '',
      Usage: player.advanced?.usageRate ? (player.advanced.usageRate * 100).toFixed(1) : '',
      FGPct: player.fieldGoalPct ? (player.fieldGoalPct * 100).toFixed(1) : '',
      
      // Analysis Helpers
      IsHome: player.teamAbbreviation === home.team.abbreviation ? 'Y' : 'N',
      GamesPlayed: player.gamesPlayed || 0,
      
      LastUpdated: timestamp
    });
  });
  
  // GAME SCRIPT ANALYSIS - Strategic insights sheet
  if (gameScriptAnalysisData) {
    gameScriptData.push({
      Date: gameDate,
      Matchup: `${away.team.abbreviation} @ ${home.team.abbreviation}`,
      AwayTeam: away.team.abbreviation,
      HomeTeam: home.team.abbreviation,
      
      // Strategic Battles
      KeyBattle1: gameScriptAnalysisData.keyBattles[0]?.type || '',
      Battle1Winner: gameScriptAnalysisData.keyBattles[0]?.advantage || '',
      Battle1Confidence: gameScriptAnalysisData.keyBattles[0]?.confidence || '',
      
      KeyBattle2: gameScriptAnalysisData.keyBattles[1]?.type || '',
      Battle2Winner: gameScriptAnalysisData.keyBattles[1]?.advantage || '',
      Battle2Confidence: gameScriptAnalysisData.keyBattles[1]?.confidence || '',
      
      // Recommendations
      AwayStrategy: gameScriptAnalysisData.awayStrategy || '',
      HomeStrategy: gameScriptAnalysisData.homeStrategy || '',
      
      // Analysis Quality
      AnalysisConfidence: gameScriptAnalysisData.confidence || 'Conservative',
      BattleCount: gameScriptAnalysisData.keyBattles?.length || 0,
      
      LastUpdated: timestamp
    });
  }
}

/**
 * NEW: Calculate enhanced projections for CSV with clear boost tracking
 */
function calculatePlayerEnhancementsForCsv(player, playerTeam, opponentTeam) {
  // Start with base projections
  let enhancedPoints = player.points || 0;
  let enhancedRebounds = player.rebounds || 0;
  let enhancedAssists = player.assists || 0;
  let enhancedMinutes = player.minutes || 0;
  
  let totalBoost = 0;
  let gameScriptBoost = 0;
  let pointsBoost = 0;
  
  // Simple enhancement calculation for CSV (avoid complex dependencies)
  if (player.minutes > 15) {
    // Star player boost
    if (player.impact?.tier === 'Superstar') {
      pointsBoost += 2.0;
      totalBoost += 2.0;
    } else if (player.impact?.tier === 'Star') {
      pointsBoost += 1.5;
      totalBoost += 1.5;
    }
    
    // Injury opportunity boost
    if (player.injuryAdjusted) {
      pointsBoost += 1.0;
      totalBoost += 1.0;
    }
    
    enhancedPoints += pointsBoost;
  }
  
  return {
    points: enhancedPoints,
    rebounds: enhancedRebounds,
    assists: enhancedAssists,
    minutes: enhancedMinutes,
    pointsBoost,
    totalBoost,
    gameScriptBoost
  };
}

/**
 * Enhanced CSV output with multiple sheets for Google Sheets
 */
async function saveCsvOutput(date) {
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // 1. GAMES SUMMARY - Main analysis sheet
  if (gameData.length > 0) {
    const gamesCSV = createCleanCSV(gameData);
    const gamesFile = path.join(outputDir, `${date}_games.csv`);
    fs.writeFileSync(gamesFile, gamesCSV, 'utf8');
    console.log(`📊 Games analysis: ${date}_games.csv`);
  }
  
  // 2. PLAYER PROJECTIONS - Detailed player data  
  if (playerData.length > 0) {
    const playersCSV = createCleanCSV(playerData);
    const playersFile = path.join(outputDir, `${date}_players.csv`);
    fs.writeFileSync(playersFile, playersCSV, 'utf8');
    console.log(`👥 Player projections: ${date}_players.csv`);
  }
  
  // 3. GAME SCRIPT ANALYSIS - Strategic insights
  if (gameScriptData.length > 0) {
    const gameScriptCSV = createCleanCSV(gameScriptData);
    const scriptFile = path.join(outputDir, `${date}_strategy.csv`);
    fs.writeFileSync(scriptFile, gameScriptCSV, 'utf8');
    console.log(`⚔️ Strategic analysis: ${date}_strategy.csv`);
  }
  
  // 4. COMBINED SUMMARY - Quick overview
  const summaryData = gameData.map(game => ({
    Date: game.Date,
    Matchup: game.Matchup,
    Prediction: `${game.Favorite} by ${game.Margin}`,
    Total: game.Total,
    Confidence: game.Confidence,
    AwayInjuries: game.AwayInjuries,
    HomeInjuries: game.HomeInjuries
  }));
  
  if (summaryData.length > 0) {
    const summaryCSV = createCleanCSV(summaryData);
    const summaryFile = path.join(outputDir, `${date}_summary.csv`);
    fs.writeFileSync(summaryFile, summaryCSV, 'utf8');
    console.log(`📋 Quick summary: ${date}_summary.csv`);
  }
}

/**
 * NEW: Create clean CSV with proper formatting for Google Sheets
 */
function createCleanCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  
  const rows = data.map(row => {
    return headers.map(header => {
      let value = row[header];
      
      // Clean up values for Google Sheets
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string
      value = String(value);
      
      // Handle special cases
      if (value === 'N/A' || value === 'null' || value === 'undefined') {
        return '';
      }
      
      // Escape commas and quotes properly
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}



/**
 * NEW: Fetch team's lineup combinations and rotation data
 * Uses the new lineups Cloudflare Worker to get 5-man unit stats
 */
async function fetchTeamLineups(teamId, season = '2024-25', lastNGames = 10) {
  try {
    console.log(`   🔄 Fetching lineup data for team ${teamId}...`);
    
    const response = await fetch(`${WORKERS.lineups}/lineups?team=${teamId}&season=${season}&lastN=${lastNGames}`);
    const data = await response.json();
    
    if (data.success && data.lineups) {
      console.log(`   ✅ Retrieved ${data.lineups.length} lineup combinations`);
      
      // Process the lineup data for easy consumption
      const processedLineups = {
        primaryLineups: data.lineups.filter(l => l.minutesTogether > 50).slice(0, 5),
        allLineups: data.lineups,
        rotationIntelligence: analyzeRotationPatterns(data.lineups),
        dataSource: data.metadata.dataSource || 'NBA_LINEUPS'
      };
      
      return {
        success: true,
        ...processedLineups
      };
      
    } else {
      console.log(`   ⚠️  No lineup data available: ${data.error || 'Unknown error'}`);
      return {
        success: false,
        primaryLineups: [],
        allLineups: [],
        rotationIntelligence: {},
        dataSource: 'ERROR'
      };
    }
    
  } catch (error) {
    console.log(`   ❌ Error fetching lineup data: ${error.message}`);
    return {
      success: false,
      primaryLineups: [],
      allLineups: [],
      rotationIntelligence: {},
      dataSource: 'ERROR'
    };
  }
}

/**
 * NEW: Analyze rotation patterns from lineup data
 * Identifies starting lineups, bench units, closing lineups
 */
function analyzeRotationPatterns(lineups) {
  if (!lineups || lineups.length === 0) {
    return {
      startingLineup: null,
      benchUnits: [],
      closingLineup: null,
      rotationDepth: 0,
      confidence: 0
    };
  }

  // Sort by minutes played to identify most-used lineups
  const sortedLineups = [...lineups].sort((a, b) => b.minutesTogether - a.minutesTogether);
  
  // Identify different types of lineups
  const startingLineup = sortedLineups[0]; // Most minutes = likely starting lineup
  const benchUnits = sortedLineups.filter(l => 
    l.minutesTogether > 20 && 
    l.minutesTogether < startingLineup.minutesTogether * 0.7
  ).slice(0, 3);
  
  // Closing lineup is often high plus/minus with decent minutes
  const closingLineup = sortedLineups
    .filter(l => l.minutesTogether > 30)
    .sort((a, b) => b.plusMinus - a.plusMinus)[0];

  // Calculate confidence based on data quality
  const totalMinutes = lineups.reduce((sum, l) => sum + l.minutesTogether, 0);
  const confidence = Math.min(0.95, Math.max(0.3, totalMinutes / 300));

  return {
    startingLineup,
    benchUnits,
    closingLineup,
    rotationDepth: lineups.length,
    confidence,
    totalMinutesAnalyzed: totalMinutes
  };
}

/**
 * NEW: Fetch team's style profile (pace, shot selection, defensive tendencies)
 */
async function fetchTeamStyleProfile(teamId, season = '2024-25', lastNGames = 10) {
  try {
    console.log(`   🎯 Fetching team style profile for team ${teamId}...`);
    
    const response = await fetch(`${WORKERS.teamstyle}/profile?team=${teamId}&season=${season}&lastN=${lastNGames}`);
    const data = await response.json();
    
    if (data.success && data.profile) {
      console.log(`   ✅ Retrieved team style profile (pace: ${data.profile.offensiveStyle?.pace || 'N/A'})`);
      
      return {
        success: true,
        profile: data.profile,
        dataSource: data.metadata.dataSource || 'NBA_ADVANCED_STATS'
      };
      
    } else {
      console.log(`   ⚠️  No team style data available: ${data.error || 'Unknown error'}`);
      return {
        success: false,
        profile: {},
        dataSource: 'ERROR'
      };
    }
    
  } catch (error) {
    console.log(`   ❌ Error fetching team style: ${error.message}`);
    return {
      success: false,
      profile: {},
      dataSource: 'ERROR'
    };
  }
}

/**
 * NEW: Display lineup and rotation analysis
 */
function displayLineupAnalysis(awayTeam, homeTeam, awayLineups, homeLineups) {
  console.log('\n' + '─'.repeat(80));
  console.log('🔄 LINEUP & ROTATION ANALYSIS');
  console.log('─'.repeat(80));

  // Display away team lineups
  if (awayLineups.success && awayLineups.rotationIntelligence) {
    const awayRI = awayLineups.rotationIntelligence;
    console.log(`\n📊 ${awayTeam.abbreviation} - ${awayTeam.name}`);
    console.log(`• Rotation Confidence: ${(awayRI.confidence * 100).toFixed(0)}%`);
    console.log(`• Total Lineups Analyzed: ${awayRI.rotationDepth}`);
    
    if (awayRI.startingLineup) {
      console.log('\n🏀 Primary Starting Lineup:');
      console.log(`• Players: ${awayRI.startingLineup.players.join(', ')}`);
      console.log(`• Minutes Together: ${awayRI.startingLineup.minutesTogether.toFixed(1)}`);
      console.log(`• Plus/Minus: ${awayRI.startingLineup.plusMinus > 0 ? '+' : ''}${awayRI.startingLineup.plusMinus.toFixed(1)}`);
      console.log(`• Field Goal %: ${(awayRI.startingLineup.fieldGoalPercentage * 100).toFixed(1)}%`);
    }
    
    if (awayRI.closingLineup && awayRI.closingLineup !== awayRI.startingLineup) {
      console.log('\n🎯 Closing Lineup:');
      console.log(`• Players: ${awayRI.closingLineup.players.join(', ')}`);
      console.log(`• Plus/Minus: ${awayRI.closingLineup.plusMinus > 0 ? '+' : ''}${awayRI.closingLineup.plusMinus.toFixed(1)}`);
    }
    
    if (awayRI.benchUnits.length > 0) {
      console.log('\n🪑 Key Bench Unit:');
      const topBench = awayRI.benchUnits[0];
      console.log(`• Players: ${topBench.players.join(', ')}`);
      console.log(`• Minutes: ${topBench.minutesTogether.toFixed(1)} | Plus/Minus: ${topBench.plusMinus > 0 ? '+' : ''}${topBench.plusMinus.toFixed(1)}`);
    }
  } else {
    console.log(`\n⚠️  ${awayTeam.abbreviation} lineup data unavailable: ${awayLineups.dataSource}`);
  }

  // Display home team lineups  
  if (homeLineups.success && homeLineups.rotationIntelligence) {
    const homeRI = homeLineups.rotationIntelligence;
    console.log(`\n📊 ${homeTeam.abbreviation} - ${homeTeam.name}`);
    console.log(`• Rotation Confidence: ${(homeRI.confidence * 100).toFixed(0)}%`);
    console.log(`• Total Lineups Analyzed: ${homeRI.rotationDepth}`);
    
    if (homeRI.startingLineup) {
      console.log('\n🏀 Primary Starting Lineup:');
      console.log(`• Players: ${homeRI.startingLineup.players.join(', ')}`);
      console.log(`• Minutes Together: ${homeRI.startingLineup.minutesTogether.toFixed(1)}`);
      console.log(`• Plus/Minus: ${homeRI.startingLineup.plusMinus > 0 ? '+' : ''}${homeRI.startingLineup.plusMinus.toFixed(1)}`);
      console.log(`• Field Goal %: ${(homeRI.startingLineup.fieldGoalPercentage * 100).toFixed(1)}%`);
    }
    
    if (homeRI.closingLineup && homeRI.closingLineup !== homeRI.startingLineup) {
      console.log('\n🎯 Closing Lineup:');
      console.log(`• Players: ${homeRI.closingLineup.players.join(', ')}`);
      console.log(`• Plus/Minus: ${homeRI.closingLineup.plusMinus > 0 ? '+' : ''}${homeRI.closingLineup.plusMinus.toFixed(1)}`);
    }
    
    if (homeRI.benchUnits.length > 0) {
      console.log('\n🪑 Key Bench Unit:');
      const topBench = homeRI.benchUnits[0];
      console.log(`• Players: ${topBench.players.join(', ')}`);
      console.log(`• Minutes: ${topBench.minutesTogether.toFixed(1)} | Plus/Minus: ${topBench.plusMinus > 0 ? '+' : ''}${topBench.plusMinus.toFixed(1)}`);
    }
  } else {
    console.log(`\n⚠️  ${homeTeam.abbreviation} lineup data unavailable: ${homeLineups.dataSource}`);
  }

  // Compare lineups if both teams have data
  if (awayLineups.success && homeLineups.success) {
    console.log('\n🔥 LINEUP MATCHUP INSIGHTS:');
    
    const awayStarter = awayLineups.rotationIntelligence.startingLineup;
    const homeStarter = homeLineups.rotationIntelligence.startingLineup;
    
    if (awayStarter && homeStarter) {
      console.log('• Starting Lineup Battle:');
      
      const awayPlusMinus = awayStarter.plusMinus;
      const homePlusMinus = homeStarter.plusMinus;
      
      if (awayPlusMinus > homePlusMinus) {
        console.log(`  → ${awayTeam.abbreviation} advantage: ${(awayPlusMinus - homePlusMinus).toFixed(1)} better plus/minus`);
      } else if (homePlusMinus > awayPlusMinus) {
        console.log(`  → ${homeTeam.abbreviation} advantage: ${(homePlusMinus - awayPlusMinus).toFixed(1)} better plus/minus`);
      } else {
        console.log('  → Even matchup based on plus/minus');
      }
      
      // Pace comparison
      const awayPace = awayStarter.pace || 100;
      const homePace = homeStarter.pace || 100;
      const paceGap = Math.abs(awayPace - homePace);
      
      if (paceGap > 3) {
        const fasterTeam = awayPace > homePace ? awayTeam.abbreviation : homeTeam.abbreviation;
        console.log(`  → Pace clash: ${fasterTeam} prefers faster tempo (+${paceGap.toFixed(1)} pace difference)`);
      }
      
      // Shooting comparison
      const awayFG = awayStarter.fieldGoalPercentage || 0.45;
      const homeFG = homeStarter.fieldGoalPercentage || 0.45;
      const fgGap = Math.abs(awayFG - homeFG);
      
      if (fgGap > 0.03) {
        const betterShooting = awayFG > homeFG ? awayTeam.abbreviation : homeTeam.abbreviation;
        console.log(`  → Shooting edge: ${betterShooting} lineup shoots ${(fgGap * 100).toFixed(1)}% better`);
      }
    }
  }
  
  console.log('\n💡 This lineup data helps predict rotation patterns and player opportunity!');
}

/**
 * NEW: Display enhanced matchup analysis including team styles
 */
function displayEnhancedMatchupAnalysis(awayTeam, homeTeam, awayLineups, homeLineups, awayStyle, homeStyle) {
  console.log('\n' + '─'.repeat(80));
  console.log('🎯 ENHANCED MATCHUP ANALYSIS');
  console.log('─'.repeat(80));

  // Display team style profiles first
  displayTeamStyleProfiles(awayTeam, homeTeam, awayStyle, homeStyle);
  
  // Then display lineup analysis
  displayLineupAnalysis(awayTeam, homeTeam, awayLineups, homeLineups);
  
  // Finally, display style vs lineup insights
  displayStyleLineupInsights(awayTeam, homeTeam, awayLineups, homeLineups, awayStyle, homeStyle);
}

/**
 * Display team style DNA profiles
 */
function displayTeamStyleProfiles(awayTeam, homeTeam, awayStyle, homeStyle) {
  console.log('\n🧬 TEAM STYLE DNA PROFILES');
  console.log('─'.repeat(50));

  // Away team style
  if (awayStyle.success && awayStyle.profile) {
    const profile = awayStyle.profile;
    console.log(`\n📊 ${awayTeam.abbreviation} - ${awayTeam.name}`);
    
    if (profile.teamDNA) {
      console.log(`• Playing Style: ${profile.teamDNA.primaryStyle}`);
      console.log(`• Pace: ${profile.teamDNA.pace} ${profile.offensiveStyle?.pace ? `(${profile.offensiveStyle.pace.toFixed(1)} possessions)` : '(data pending)'}`);
      console.log(`• Offense: ${profile.teamDNA.offense}`);
      console.log(`• Defense: ${profile.teamDNA.defense}`);
    }
    
    if (profile.offensiveStyle) {
      const off = profile.offensiveStyle;
      console.log(`• Three-Point Rate: ${(off.shotSelection?.threePointRate * 100)?.toFixed(1) || 'N/A'}%`);
      console.log(`• Assist Rate: ${(off.ballMovement?.assistRate * 100)?.toFixed(1) || 'N/A'}%`);
      console.log(`• Offensive Rating: ${off.offensiveRating?.toFixed(1) || 'Pending'}`);
    }
    
    if (profile.defensiveStyle) {
      const def = profile.defensiveStyle;
      console.log(`• Defensive Rating: ${def.defensiveRating?.toFixed(1) || 'Pending'}`);
      console.log(`• Steal Rate: ${(def.pressure?.stealRate * 100)?.toFixed(2) || 'N/A'}%`);
    }
    
    if (profile.teamDNA?.keyStrengths?.length > 0) {
      console.log(`• Strengths: ${profile.teamDNA.keyStrengths.join(', ')}`);
    }
    
    if (profile.teamDNA?.keyWeaknesses?.length > 0) {
      console.log(`• Weaknesses: ${profile.teamDNA.keyWeaknesses.join(', ')}`);
    }
    
    // Show data availability warning if key metrics are missing
    const missingMetrics = [];
    if (!profile.offensiveStyle?.pace) missingMetrics.push('pace');
    if (!profile.offensiveStyle?.offensiveRating) missingMetrics.push('offensive rating');
    if (!profile.defensiveStyle?.defensiveRating) missingMetrics.push('defensive rating');
    
    if (missingMetrics.length > 0) {
      console.log(`⚠️  Advanced metrics pending: ${missingMetrics.join(', ')} (early season)`);
    }
    
  } else {
    console.log(`\n⚠️  ${awayTeam.abbreviation} team style data unavailable: ${awayStyle.dataSource}`);
  }

  // Home team style
  if (homeStyle.success && homeStyle.profile) {
    const profile = homeStyle.profile;
    console.log(`\n📊 ${homeTeam.abbreviation} - ${homeTeam.name}`);
    
    if (profile.teamDNA) {
      console.log(`• Playing Style: ${profile.teamDNA.primaryStyle}`);
      console.log(`• Pace: ${profile.teamDNA.pace} ${profile.offensiveStyle?.pace ? `(${profile.offensiveStyle.pace.toFixed(1)} possessions)` : '(data pending)'}`);
      console.log(`• Offense: ${profile.teamDNA.offense}`);
      console.log(`• Defense: ${profile.teamDNA.defense}`);
    }
    
    if (profile.offensiveStyle) {
      const off = profile.offensiveStyle;
      console.log(`• Three-Point Rate: ${(off.shotSelection?.threePointRate * 100)?.toFixed(1) || 'N/A'}%`);
      console.log(`• Assist Rate: ${(off.ballMovement?.assistRate * 100)?.toFixed(1) || 'N/A'}%`);
      console.log(`• Offensive Rating: ${off.offensiveRating?.toFixed(1) || 'Pending'}`);
    }
    
    if (profile.defensiveStyle) {
      const def = profile.defensiveStyle;
      console.log(`• Defensive Rating: ${def.defensiveRating?.toFixed(1) || 'Pending'}`);
      console.log(`• Steal Rate: ${(def.pressure?.stealRate * 100)?.toFixed(2) || 'N/A'}%`);
    }
    
    if (profile.teamDNA?.keyStrengths?.length > 0) {
      console.log(`• Strengths: ${profile.teamDNA.keyStrengths.join(', ')}`);
    }
    
    if (profile.teamDNA?.keyWeaknesses?.length > 0) {
      console.log(`• Weaknesses: ${profile.teamDNA.keyWeaknesses.join(', ')}`);
    }
    
    // Show data availability warning if key metrics are missing
    const missingMetrics = [];
    if (!profile.offensiveStyle?.pace) missingMetrics.push('pace');
    if (!profile.offensiveStyle?.offensiveRating) missingMetrics.push('offensive rating');
    if (!profile.defensiveStyle?.defensiveRating) missingMetrics.push('defensive rating');
    
    if (missingMetrics.length > 0) {
      console.log(`⚠️  Advanced metrics pending: ${missingMetrics.join(', ')} (early season)`);
    }
    
  } else {
    console.log(`\n⚠️  ${homeTeam.abbreviation} team style data unavailable: ${homeStyle.dataSource}`);
  }
}

/**
 * Display style vs lineup insights (the magic happens here!)
 */
function displayStyleLineupInsights(awayTeam, homeTeam, awayLineups, homeLineups, awayStyle, homeStyle) {
  if (!awayStyle.success || !homeStyle.success) return;
  
  console.log('\n🔥 STYLE vs LINEUP MATCHUP INSIGHTS');
  console.log('─'.repeat(50));
  
  const awayProfile = awayStyle.profile;
  const homeProfile = homeStyle.profile;
  
  // NEW: Enhanced pace analysis using sophisticated calculation
  console.log('\n⚡ Pace & Tempo Battle:');
  
  // Try to create mock team data for sophisticated pace calculation
  const mockAwayData = { 
    stats: { advanced: { pace: awayProfile.offensiveStyle?.pace } },
    teamStyle: awayStyle,
    lineups: awayLineups 
  };
  const mockHomeData = { 
    stats: { advanced: { pace: homeProfile.offensiveStyle?.pace } },
    teamStyle: homeStyle,
    lineups: homeLineups 
  };
  
  // Check if we have enough data for sophisticated pace analysis
  if (awayProfile.offensiveStyle?.pace && homeProfile.offensiveStyle?.pace) {
    // Full sophisticated pace analysis available
    const paceAnalysis = calculateSophisticatedPace(mockAwayData, mockHomeData);
    const awayPace = awayProfile.offensiveStyle.pace;
    const homePace = homeProfile.offensiveStyle.pace;
    const paceGap = Math.abs(awayPace - homePace);
    
    if (paceGap > 3) {
      const fasterTeam = awayPace > homePace ? awayTeam.abbreviation : homeTeam.abbreviation;
      const slowerTeam = awayPace < homePace ? awayTeam.abbreviation : homeTeam.abbreviation;
      console.log(`• Major pace clash: ${fasterTeam} (+${paceGap.toFixed(1)} faster) vs ${slowerTeam}`);
    }
    
    console.log(`• Sophisticated pace prediction: ${paceAnalysis.base.toFixed(1)} possessions`);
    console.log(`• Calculation factors: ${paceAnalysis.breakdown.join(' + ')}`);
    console.log(`• Prediction confidence: ${paceAnalysis.confidence} (${paceAnalysis.dataLayers} data layers)`);
    
  } else {
    // Fallback to team stats pace analysis  
    console.log('• Style pace data pending (early season)');
    console.log('• Using team stats pace for game prediction (see prediction section)');
    console.log('• System will automatically upgrade to sophisticated pace when style data becomes available');
  }
  
  // Shot selection clash
  if (awayProfile.offensiveStyle?.shotSelection && homeProfile.offensiveStyle?.shotSelection) {
    const away3Rate = awayProfile.offensiveStyle.shotSelection.threePointRate;
    const home3Rate = homeProfile.offensiveStyle.shotSelection.threePointRate;
    
    console.log('\n🎯 Shot Selection Battle:');
    console.log(`• ${awayTeam.abbreviation} three-point rate: ${(away3Rate * 100).toFixed(1)}%`);
    console.log(`• ${homeTeam.abbreviation} three-point rate: ${(home3Rate * 100).toFixed(1)}%`);
    
    if (Math.abs(away3Rate - home3Rate) > 0.05) {
      const more3Team = away3Rate > home3Rate ? awayTeam.abbreviation : homeTeam.abbreviation;
      console.log(`• ${more3Team} significantly more three-point heavy (+${(Math.abs(away3Rate - home3Rate) * 100).toFixed(1)}%)`);
    }
  }
  
  // Defensive matchup analysis
  if (awayProfile.defensiveStyle && homeProfile.defensiveStyle) {
    console.log('\n🛡️ Defensive Style Clash:');
    
    const awayStealRate = awayProfile.defensiveStyle.pressure?.stealRate || 0;
    const homeStealRate = homeProfile.defensiveStyle.pressure?.stealRate || 0;
    
    if (Math.abs(awayStealRate - homeStealRate) > 0.01) {
      const pressureTeam = awayStealRate > homeStealRate ? awayTeam.abbreviation : homeTeam.abbreviation;
      console.log(`• ${pressureTeam} applies more defensive pressure (steal rate advantage)`);
    } else {
      console.log('• Similar defensive pressure styles');
    }
  }
  
  // Lineup efficiency vs team style
  if (awayLineups.success && homeLineups.success) {
    console.log('\n📈 Lineup Efficiency vs Team Style:');
    
    const awayStarter = awayLineups.rotationIntelligence?.startingLineup;
    const homeStarter = homeLineups.rotationIntelligence?.startingLineup;
    
    if (awayStarter && homeStarter) {
      // Use available ratings or show pending
      const awayOffRating = awayProfile.offensiveStyle?.offensiveRating;
      const homeOffRating = homeProfile.offensiveStyle?.offensiveRating;
      
      if (awayOffRating && homeOffRating) {
        console.log(`• ${awayTeam.abbreviation} starting lineup +/- vs team rating: ${awayStarter.plusMinus?.toFixed(1) || 'N/A'} vs ${awayOffRating.toFixed(1)}`);
        console.log(`• ${homeTeam.abbreviation} starting lineup +/- vs team rating: ${homeStarter.plusMinus?.toFixed(1) || 'N/A'} vs ${homeOffRating.toFixed(1)}`);
      } else {
        console.log(`• Lineup +/- analysis: ${awayTeam.abbreviation} ${awayStarter.plusMinus?.toFixed(1) || 'N/A'}, ${homeTeam.abbreviation} ${homeStarter.plusMinus?.toFixed(1) || 'N/A'}`);
        console.log('• Team efficiency ratings pending (early season)');
      }
    }
  }
  
  // Key strategic insights
  console.log('\n🧠 Strategic Insights:');
  
  if (awayProfile.teamDNA?.keyStrengths && homeProfile.teamDNA?.keyWeaknesses) {
    const matchups = findStyleMatchups(awayProfile.teamDNA.keyStrengths, homeProfile.teamDNA.keyWeaknesses);
    if (matchups.length > 0) {
      console.log(`• ${awayTeam.abbreviation} can exploit: ${matchups.join(', ')}`);
    }
  }
  
  if (homeProfile.teamDNA?.keyStrengths && awayProfile.teamDNA?.keyWeaknesses) {
    const matchups = findStyleMatchups(homeProfile.teamDNA.keyStrengths, awayProfile.teamDNA.keyWeaknesses);
    if (matchups.length > 0) {
      console.log(`• ${homeTeam.abbreviation} can exploit: ${matchups.join(', ')}`);
    }
  }
  
  // Check for missing advanced metrics
  const missingMetrics = [];
  if (!awayProfile.offensiveStyle?.pace || !homeProfile.offensiveStyle?.pace) {
    missingMetrics.push('pace analysis');
  }
  if (!awayProfile.offensiveStyle?.offensiveRating || !homeProfile.offensiveStyle?.offensiveRating) {
    missingMetrics.push('efficiency ratings');
  }
  
  if (missingMetrics.length > 0) {
    console.log(`\n⚠️  Advanced analysis limited by missing: ${missingMetrics.join(', ')}`);
    console.log('📈 Predictions using available data (shot patterns, lineup intelligence, team stats)');
  }
  
  console.log('\n💡 This enhanced analysis combines rotation intelligence with team DNA!');
}

/**
 * Find where one team's strengths match another's weaknesses
 */
function findStyleMatchups(strengths, weaknesses) {
  const matchups = [];
  
  // Map strengths to opposing weaknesses
  const strengthWeaknessMap = {
    'Three-Point Shooting': 'Three-Point Defense',
    'Interior Scoring': 'Defensive Efficiency',
    'Fast Pace': 'Ball Security',
    'Ball Movement': 'Defensive Efficiency',
    'Elite Defense': 'Offensive Efficiency'
  };
  
  strengths.forEach(strength => {
    const opposingWeakness = strengthWeaknessMap[strength];
    if (opposingWeakness && weaknesses.includes(opposingWeakness)) {
      matchups.push(`${strength} vs ${opposingWeakness}`);
    }
  });
  
  return matchups;
}

main().catch(console.error);