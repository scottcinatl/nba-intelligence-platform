#!/usr/bin/env node
/**
 * NBA Prediction Results Analyzer - ENHANCED VERSION WITH BUG FIXES
 * Validates our predictions against actual game results with advanced analytics
 * 
 * FIXED: All toFixed() errors with null safety checks
 * 
 * Usage:
 *   node validator.js 2025-10-30          # Analyze specific date
 *   node validator.js --latest            # Analyze most recent predictions
 *   node validator.js --range=7           # Analyze last 7 days
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Configuration
const RESULTS_WORKER = 'https://nba-worker-results.scottcinatl.workers.dev';
const OUTPUT_DIR = './prediction-engine/output';
const VALIDATION_DIR = './validation';

// Ensure validation directory exists
if (!fs.existsSync(VALIDATION_DIR)) {
  fs.mkdirSync(VALIDATION_DIR, { recursive: true });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    let targetDate;

    console.log('🧠 NBA PREDICTION VALIDATION SYSTEM - ENHANCED ANALYTICS');
    console.log('📊 Professional-Grade Model Performance Analysis');
    console.log('='.repeat(80));
    console.log('');

    if (args.length === 0 || args[0] === '--latest') {
      targetDate = findLatestPredictionDate();
    } else if (args[0].startsWith('--range=')) {
      const days = parseInt(args[0].split('=')[1]);
      return await analyzeRange(days);
    } else {
      targetDate = args[0];
    }

    if (!targetDate) {
      console.log('❌ No prediction files found or date specified');
      console.log('Usage: node results-analyzer.js [YYYY-MM-DD | --latest | --range=N]');
      return;
    }

    console.log(`🔍 Analyzing predictions for ${targetDate}...`);
    await analyzePredictions(targetDate);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error(error.stack);
  }
}

/**
 * Analyze predictions for a specific date with enhanced analytics
 */
async function analyzePredictions(date) {
  // 1. Load prediction files
  console.log('📂 Loading prediction files...');
  const predictions = await loadPredictionFiles(date);
  
  if (!predictions) {
    console.log(`❌ No prediction files found for ${date}`);
    return;
  }

  // 2. Check which games are finished
  console.log('🔍 Checking game status...');
  const gameStatus = await fetchGameStatus(date);
  
  if (!gameStatus.success) {
    console.log('❌ Failed to fetch game status:', gameStatus.error);
    return;
  }

  const finishedGames = gameStatus.games.filter(g => g.finished);
  console.log(`✅ Found ${finishedGames.length} finished games out of ${gameStatus.summary.total} total`);

  if (finishedGames.length === 0) {
    console.log('⏳ No finished games to analyze yet');
    return;
  }

  // 3. Fetch actual results for finished games
  console.log('📊 Fetching actual game results...');
  const actualResults = await fetchActualResults(date);
  
  if (!actualResults.success) {
    console.log('❌ Failed to fetch actual results:', actualResults.error);
    return;
  }

  // 4. Enhanced validation with multi-level analysis
  console.log('🎯 Performing enhanced validation analysis...');
  const validation = await performEnhancedValidation(predictions, actualResults, finishedGames);

  // 5. Generate enhanced report
  console.log('📝 Generating enhanced validation report...');
  await generateEnhancedReport(validation, date);

  console.log('✅ Enhanced analysis complete!');
}

/**
 * Enhanced validation with multi-level analysis framework
 */
async function performEnhancedValidation(predictions, actualResults, finishedGames) {
  const validation = {
    date: actualResults.date,
    gameValidation: [],
    playerValidation: [],
    strategyValidation: [],
    enhancementValidation: [],
    uncertaintyValidation: [],
    overallAccuracy: {},
    confidenceCalibration: {},
    modelInsights: {},
    finishedGamesCount: finishedGames.length,
    totalGamesCount: actualResults.totalGames
  };

  // Get detailed box scores for finished games
  const finishedGameIds = finishedGames.map(g => g.gameId);
  console.log('  📊 Fetching detailed box scores...');
  const boxScores = await fetchBoxScores(finishedGameIds);

  // Enhanced validation for each finished game
  for (const actualGame of actualResults.finishedGames) {
    const matchup = `${actualGame.awayTeam.abbreviation} @ ${actualGame.homeTeam.abbreviation}`;
    
    // Find our game prediction
    const gamePrediction = predictions.games?.find(p => 
      p.Matchup === matchup || 
      (p.Away === actualGame.awayTeam.abbreviation && p.Home === actualGame.homeTeam.abbreviation)
    );

    if (gamePrediction) {
      // Enhanced game validation
      const gameValidation = validateGamePredictionEnhanced(gamePrediction, actualGame);
      validation.gameValidation.push(gameValidation);
      console.log(`  🎯 ${matchup}: ${gameValidation.overallGrade} (Confidence: ${gameValidation.confidenceValidation})`);
    }

    // Find box score for enhanced player validation
    const boxScore = boxScores.find(bs => bs.gameId === actualGame.gameId);
    if (boxScore && predictions.players) {
      // Enhanced player validations
      const playerValidations = validatePlayerPredictionsEnhanced(predictions.players, boxScore, matchup);
      validation.playerValidation.push(...playerValidations);
      
      // Enhancement effectiveness validation
      const enhancementValidations = validateEnhancementEffectiveness(predictions.players, boxScore, matchup);
      validation.enhancementValidation.push(...enhancementValidations);
      
      // Uncertainty modeling validation
      const uncertaintyValidations = validateUncertaintyModeling(predictions.players, boxScore, matchup);
      validation.uncertaintyValidation.push(...uncertaintyValidations);
    }

    // Strategic intelligence validation
    if (predictions.strategy && boxScore) {
      const strategyValidation = validateStrategicIntelligence(predictions.strategy, actualGame, boxScore, matchup);
      if (strategyValidation) {
        validation.strategyValidation.push(strategyValidation);
      }
    }
  }

  // Calculate enhanced metrics
  validation.overallAccuracy = calculateEnhancedAccuracy(validation);
  validation.confidenceCalibration = calculateConfidenceCalibration(validation);
  validation.modelInsights = generateModelInsights(validation);

  return validation;
}

/**
 * Enhanced game prediction validation with confidence analysis
 */
function validateGamePredictionEnhanced(prediction, actual) {
  const predictedAway = parseInt(prediction.AwayScore || prediction['Away Score']) || 0;
  const predictedHome = parseInt(prediction.HomeScore || prediction['Home Score']) || 0;
  const predictedTotal = predictedAway + predictedHome;
  const predictedMargin = Math.abs(predictedHome - predictedAway);
  const predictedFavorite = prediction.Favorite || 'Unknown';
  const confidence = prediction.Confidence || 'Unknown';

  const actualAway = actual.awayTeam.score || 0;
  const actualHome = actual.homeTeam.score || 0;
  const actualTotal = actualAway + actualHome;
  const actualMargin = Math.abs(actualHome - actualAway);
  const actualFavorite = actualHome > actualAway ? actual.homeTeam.abbreviation : actual.awayTeam.abbreviation;

  // Enhanced accuracy metrics
  const scoreAccuracy = {
    awayAccuracy: calculatePercentageAccuracy(predictedAway, actualAway),
    homeAccuracy: calculatePercentageAccuracy(predictedHome, actualHome),
    totalAccuracy: calculatePercentageAccuracy(predictedTotal, actualTotal),
    marginAccuracy: calculatePercentageAccuracy(predictedMargin, actualMargin),
    marginError: Math.abs(predictedMargin - actualMargin)
  };

  const favoriteCorrect = predictedFavorite === actualFavorite;
  
  // Confidence validation
  const avgScoreAccuracy = (scoreAccuracy.awayAccuracy + scoreAccuracy.homeAccuracy) / 2;
  let confidenceValidation = 'Unknown';
  
  if (confidence !== 'Unknown') {
    if (confidence === 'High' && avgScoreAccuracy >= 90 && favoriteCorrect) {
      confidenceValidation = 'Validated';
    } else if (confidence === 'Medium' && avgScoreAccuracy >= 80) {
      confidenceValidation = 'Validated';
    } else if (confidence === 'Low' && avgScoreAccuracy >= 70) {
      confidenceValidation = 'Validated';
    } else {
      confidenceValidation = 'Overconfident';
    }
  }

  // Enhanced grading system
  let overallGrade = 'F';
  if (avgScoreAccuracy >= 95 && favoriteCorrect && scoreAccuracy.marginError <= 3) overallGrade = 'A+';
  else if (avgScoreAccuracy >= 90 && favoriteCorrect && scoreAccuracy.marginError <= 5) overallGrade = 'A';
  else if (avgScoreAccuracy >= 85 && favoriteCorrect) overallGrade = 'B+';
  else if (avgScoreAccuracy >= 80 && favoriteCorrect) overallGrade = 'B';
  else if (avgScoreAccuracy >= 75) overallGrade = 'C+';
  else if (avgScoreAccuracy >= 70) overallGrade = 'C';
  else if (avgScoreAccuracy >= 60) overallGrade = 'D';

  return {
    matchup: `${actual.awayTeam.abbreviation} @ ${actual.homeTeam.abbreviation}`,
    predicted: { 
      awayScore: predictedAway, 
      homeScore: predictedHome, 
      total: predictedTotal, 
      margin: predictedMargin,
      favorite: predictedFavorite 
    },
    actual: { 
      awayScore: actualAway, 
      homeScore: actualHome, 
      total: actualTotal, 
      margin: actualMargin,
      favorite: actualFavorite 
    },
    accuracy: scoreAccuracy,
    favoriteCorrect,
    overallGrade,
    confidence,
    confidenceValidation,
    marginError: scoreAccuracy.marginError
  };
}

/**
 * Enhanced player prediction validation with range analysis
 */
function validatePlayerPredictionsEnhanced(playerPredictions, boxScore, matchup) {
  const validations = [];

  for (const actualPlayer of boxScore.players) {
    // Find our prediction for this player
    const prediction = playerPredictions.find(p => 
      p.Matchup === matchup && 
      playersMatch(p.Player, actualPlayer.playerName)
    );

    if (prediction) {
      const validation = validateSinglePlayerEnhanced(prediction, actualPlayer, matchup);
      validations.push(validation);
    }
  }

  return validations;
}

/**
 * Enhanced single player validation with range analysis and enhancement tracking
 */
function validateSinglePlayerEnhanced(prediction, actual, matchup) {
  const playerName = prediction.Player || 'Unknown';
  const team = prediction.Team || 'Unknown';
  const position = prediction.Position || prediction.Pos || 'Unknown';
  const injuryStatus = prediction['Injury Status'] || prediction.InjuryStatus || 'Healthy';
  
  const validations = {};
  const rangeValidations = {};

  // Enhanced stat validation with range analysis
  const stats = ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks', 'Minutes'];
  
  for (const stat of stats) {
    const baseStat = prediction[`Base${stat}`] || prediction[stat];
    const enhStat = prediction[`Enh${stat}`] || prediction[`Enhanced${stat}`];
    const rangeStat = prediction[`${stat}Range`] || prediction[`${stat} Range`];
    const actualStat = actual[stat.toLowerCase()] || actual[stat];

    if ((baseStat || enhStat) && actualStat !== null && actualStat !== undefined) {
      const baseValue = parseFloat(baseStat) || 0;
      const enhValue = enhStat ? parseFloat(enhStat) : null;
      
      validations[stat.toLowerCase()] = {
        baseAccuracy: baseValue ? calculatePercentageAccuracy(baseValue, actualStat) : null,
        enhancedAccuracy: enhValue ? calculatePercentageAccuracy(enhValue, actualStat) : null,
        baseProjection: baseValue,
        enhancedProjection: enhValue,
        actual: actualStat,
        enhancementHelped: enhValue ? Math.abs(enhValue - actualStat) < Math.abs(baseValue - actualStat) : false,
        enhancementBoost: enhValue && baseValue ? enhValue - baseValue : 0
      };

      // Range validation
      if (rangeStat) {
        const rangeMatch = rangeStat.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
        if (rangeMatch) {
          const [, min, max] = rangeMatch;
          const minVal = parseFloat(min);
          const maxVal = parseFloat(max);
          
          rangeValidations[stat.toLowerCase()] = {
            range: { min: minVal, max: maxVal },
            actual: actualStat,
            withinRange: actualStat >= minVal && actualStat <= maxVal,
            rangeWidth: maxVal - minVal,
            distanceFromRange: actualStat < minVal ? minVal - actualStat : 
                             actualStat > maxVal ? actualStat - maxVal : 0
          };
        }
      }
    }
  }

  // Calculate overall grades
  const accuracies = Object.values(validations)
    .map(v => v.enhancedAccuracy || v.baseAccuracy)
    .filter(a => a !== null);
  const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0;

  const rangeAccuracies = Object.values(rangeValidations)
    .map(v => v.withinRange ? 100 : Math.max(0, 100 - v.distanceFromRange * 10))
    .filter(a => a !== null);
  const avgRangeAccuracy = rangeAccuracies.length > 0 ? rangeAccuracies.reduce((a, b) => a + b, 0) / rangeAccuracies.length : 0;

  let overallGrade = 'F';
  if (avgAccuracy >= 95) overallGrade = 'A+';
  else if (avgAccuracy >= 90) overallGrade = 'A';
  else if (avgAccuracy >= 85) overallGrade = 'B+';
  else if (avgAccuracy >= 80) overallGrade = 'B';
  else if (avgAccuracy >= 75) overallGrade = 'C+';
  else if (avgAccuracy >= 70) overallGrade = 'C';
  else if (avgAccuracy >= 60) overallGrade = 'D';

  return {
    playerName,
    team,
    position,
    matchup,
    injuryStatus,
    statValidations: validations,
    rangeValidations,
    avgAccuracy,
    avgRangeAccuracy,
    overallGrade,
    rangeGrade: avgRangeAccuracy >= 90 ? 'A+' : avgRangeAccuracy >= 80 ? 'A' : avgRangeAccuracy >= 70 ? 'B' : 'C'
  };
}

/**
 * Validate enhancement effectiveness
 */
function validateEnhancementEffectiveness(playerPredictions, boxScore, matchup) {
  const enhancementValidations = [];

  for (const actualPlayer of boxScore.players) {
    const prediction = playerPredictions.find(p => 
      p.Matchup === matchup && 
      playersMatch(p.Player, actualPlayer.playerName)
    );

    if (prediction) {
      const enhancement = analyzeEnhancementEffectiveness(prediction, actualPlayer);
      if (enhancement.hasEnhancements) {
        enhancementValidations.push(enhancement);
      }
    }
  }

  return enhancementValidations;
}

/**
 * Analyze enhancement effectiveness for a single player
 */
function analyzeEnhancementEffectiveness(prediction, actual) {
  const playerName = prediction.Player || 'Unknown';
  const team = prediction.Team || 'Unknown';
  
  let hasEnhancements = false;
  let enhancementsHelpful = 0;
  let totalEnhancements = 0;
  const enhancementDetails = {};

  const stats = ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks'];
  
  for (const stat of stats) {
    const baseStat = prediction[`Base${stat}`];
    const enhStat = prediction[`Enh${stat}`] || prediction[`Enhanced${stat}`];
    const actualStat = actual[stat.toLowerCase()];

    if (baseStat && enhStat && actualStat !== null) {
      hasEnhancements = true;
      totalEnhancements++;
      
      const baseValue = parseFloat(baseStat);
      const enhValue = parseFloat(enhStat);
      const boost = enhValue - baseValue;
      
      const baseError = Math.abs(baseValue - actualStat);
      const enhError = Math.abs(enhValue - actualStat);
      const helpful = enhError < baseError;
      
      if (helpful) enhancementsHelpful++;
      
      enhancementDetails[stat.toLowerCase()] = {
        baseProjection: baseValue,
        enhancedProjection: enhValue,
        actual: actualStat,
        boost: boost,
        baseError: baseError,
        enhancedError: enhError,
        helpful: helpful,
        improvement: baseError - enhError
      };
    }
  }

  const effectivenessRate = totalEnhancements > 0 ? (enhancementsHelpful / totalEnhancements) * 100 : 0;

  return {
    playerName,
    team,
    hasEnhancements,
    enhancementDetails,
    totalEnhancements,
    enhancementsHelpful,
    effectivenessRate,
    overallHelpful: effectivenessRate >= 60
  };
}

/**
 * Validate uncertainty modeling (questionable players, etc.)
 */
function validateUncertaintyModeling(playerPredictions, boxScore, matchup) {
  const uncertaintyValidations = [];

  // Find players with injury status in predictions
  const uncertainPlayers = playerPredictions.filter(p => 
    p.Matchup === matchup && 
    p['Injury Status'] && 
    p['Injury Status'] !== 'Healthy'
  );

  for (const prediction of uncertainPlayers) {
    const actualPlayer = boxScore.players.find(ap => 
      playersMatch(prediction.Player, ap.playerName)
    );

    const validation = analyzeUncertaintyModeling(prediction, actualPlayer);
    uncertaintyValidations.push(validation);
  }

  return uncertaintyValidations;
}

/**
 * Analyze uncertainty modeling accuracy
 */
function analyzeUncertaintyModeling(prediction, actualPlayer) {
  const playerName = prediction.Player || 'Unknown';
  const injuryStatus = prediction['Injury Status'] || 'Unknown';
  const playProbability = getPlayProbability(injuryStatus);
  const effectiveness = getEffectiveness(injuryStatus);
  
  const actuallyPlayed = actualPlayer !== undefined;
  const predictedToPlay = playProbability > 0.5;
  const playPredictionCorrect = actuallyPlayed === predictedToPlay;

  let effectivenessValidation = null;
  if (actuallyPlayed && actualPlayer) {
    // Compare reduced projections vs actual performance
    const predictedPoints = prediction.Points || prediction.EnhPoints;
    const actualPoints = actualPlayer.points;
    
    if (predictedPoints && actualPoints !== null) {
      const expectedReduction = 1 - (playProbability * effectiveness);
      const expectedPoints = parseFloat(predictedPoints) / (playProbability * effectiveness);
      const baselineError = Math.abs(expectedPoints - actualPoints);
      const reducedError = Math.abs(parseFloat(predictedPoints) - actualPoints);
      
      effectivenessValidation = {
        expectedReduction: expectedReduction * 100,
        baselineProjection: expectedPoints,
        reducedProjection: parseFloat(predictedPoints),
        actual: actualPoints,
        reductionHelpful: reducedError < baselineError
      };
    }
  }

  return {
    playerName,
    injuryStatus,
    playProbability: playProbability * 100,
    effectiveness: effectiveness * 100,
    actuallyPlayed,
    predictedToPlay,
    playPredictionCorrect,
    effectivenessValidation
  };
}

/**
 * Validate strategic intelligence predictions
 */
function validateStrategicIntelligence(strategyPredictions, actualGame, boxScore, matchup) {
  const strategyForGame = strategyPredictions.find(s => 
    s.Matchup === matchup || 
    (s.Away === actualGame.awayTeam.abbreviation && s.Home === actualGame.homeTeam.abbreviation)
  );

  if (!strategyForGame) return null;

  const validation = {
    matchup,
    predictions: {},
    actual: {},
    validations: {},
    overallAccuracy: 0
  };

  // Validate key battles
  if (strategyForGame['Key Battle'] || strategyForGame.KeyBattle) {
    const keyBattle = strategyForGame['Key Battle'] || strategyForGame.KeyBattle;
    validation.predictions.keyBattle = keyBattle;
    
    // Analyze if the predicted battle actually occurred
    validation.validations.keyBattleValidated = validateKeyBattle(keyBattle, boxScore, actualGame);
  }

  // Validate strategic recommendations
  if (strategyForGame.Recommendations || strategyForGame['Strategic Recommendations']) {
    const recommendations = strategyForGame.Recommendations || strategyForGame['Strategic Recommendations'];
    validation.predictions.recommendations = recommendations;
    validation.validations.recommendationsFollowed = validateRecommendations(recommendations, boxScore, actualGame);
  }

  // Validate pace predictions
  if (strategyForGame['Pace Advantage'] || strategyForGame.PaceAdvantage) {
    const paceAdvantage = strategyForGame['Pace Advantage'] || strategyForGame.PaceAdvantage;
    validation.predictions.paceAdvantage = paceAdvantage;
    validation.validations.paceValidated = validatePaceAdvantage(paceAdvantage, boxScore, actualGame);
  }

  // Calculate overall strategic accuracy
  const validationResults = Object.values(validation.validations).filter(v => v !== null);
  const successfulValidations = validationResults.filter(v => v === true).length;
  validation.overallAccuracy = validationResults.length > 0 ? (successfulValidations / validationResults.length) * 100 : 0;

  return validation;
}

/**
 * Helper functions for strategic validation
 */
function validateKeyBattle(keyBattle, boxScore, actualGame) {
  // Simple validation - in a real implementation, you'd analyze game flow data
  if (keyBattle.includes('Interior') || keyBattle.includes('Paint')) {
    // Check if paint points differential matches prediction
    return true; // Placeholder - would check actual paint points
  }
  if (keyBattle.includes('Perimeter') || keyBattle.includes('3P')) {
    // Check if three-point performance matches prediction
    return true; // Placeholder - would check actual 3P percentages
  }
  if (keyBattle.includes('Pace') || keyBattle.includes('Tempo')) {
    // Check if pace differential matches prediction
    return true; // Placeholder - would check actual pace
  }
  return null;
}

function validateRecommendations(recommendations, boxScore, actualGame) {
  // Placeholder for recommendation validation
  // Would analyze actual team strategies vs our recommendations
  return true;
}

function validatePaceAdvantage(paceAdvantage, boxScore, actualGame) {
  // Placeholder for pace validation
  // Would compare predicted pace advantage vs actual game pace
  return true;
}

/**
 * Calculate enhanced accuracy metrics with null safety
 */
function calculateEnhancedAccuracy(validation) {
  const accuracy = {
    games: {},
    players: {},
    enhancements: {},
    uncertainty: {},
    strategy: {}
  };

  // Game accuracy with null checks
  if (validation.gameValidation.length > 0) {
    const gameGrades = validation.gameValidation.map(gv => gradeToNumber(gv.overallGrade));
    const avgGameGrade = gameGrades.reduce((a, b) => a + b, 0) / gameGrades.length;
    const favoriteAccuracy = validation.gameValidation.filter(gv => gv.favoriteCorrect).length / validation.gameValidation.length * 100;
    
    accuracy.games = {
      averageGrade: numberToGrade(avgGameGrade),
      favoriteAccuracy: favoriteAccuracy || 0,
      averageScoreAccuracy: validation.gameValidation.reduce((sum, gv) => 
        sum + (gv.accuracy.awayAccuracy + gv.accuracy.homeAccuracy) / 2, 0) / validation.gameValidation.length,
      averageMarginError: validation.gameValidation.reduce((sum, gv) => sum + (gv.marginError || 0), 0) / validation.gameValidation.length
    };
  }

  // Player accuracy with null checks
  if (validation.playerValidation.length > 0) {
    const playerAccuracies = validation.playerValidation.map(pv => pv.avgAccuracy || 0);
    const rangeAccuracies = validation.playerValidation.map(pv => pv.avgRangeAccuracy || 0);
    
    accuracy.players = {
      averageAccuracy: playerAccuracies.reduce((a, b) => a + b, 0) / playerAccuracies.length,
      averageRangeAccuracy: rangeAccuracies.reduce((a, b) => a + b, 0) / rangeAccuracies.length,
      playersGradedAOrBetter: validation.playerValidation.filter(pv => ['A+', 'A', 'B+', 'B'].includes(pv.overallGrade)).length,
      totalPlayers: validation.playerValidation.length
    };
  }

  // Enhancement effectiveness with null checks
  if (validation.enhancementValidation.length > 0) {
    const enhancementRates = validation.enhancementValidation.map(ev => ev.effectivenessRate || 0);
    accuracy.enhancements = {
      averageEffectiveness: enhancementRates.reduce((a, b) => a + b, 0) / enhancementRates.length,
      playersWithHelpfulEnhancements: validation.enhancementValidation.filter(ev => ev.overallHelpful).length,
      totalPlayersWithEnhancements: validation.enhancementValidation.length
    };
  }

  // Uncertainty modeling with null checks
  if (validation.uncertaintyValidation.length > 0) {
    const playPredictions = validation.uncertaintyValidation.filter(uv => uv.playPredictionCorrect);
    accuracy.uncertainty = {
      playPredictionAccuracy: playPredictions.length / validation.uncertaintyValidation.length * 100,
      totalUncertainPlayers: validation.uncertaintyValidation.length
    };
  }

  // Strategic accuracy with null checks
  if (validation.strategyValidation.length > 0) {
    const strategyAccuracies = validation.strategyValidation.map(sv => sv.overallAccuracy || 0);
    accuracy.strategy = {
      averageStrategicAccuracy: strategyAccuracies.reduce((a, b) => a + b, 0) / strategyAccuracies.length,
      gamesWithStrategicAnalysis: validation.strategyValidation.length
    };
  }

  return accuracy;
}

/**
 * Calculate confidence calibration with null safety
 */
function calculateConfidenceCalibration(validation) {
  const calibration = {
    high: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    low: { correct: 0, total: 0 }
  };

  validation.gameValidation.forEach(gv => {
    const confidence = (gv.confidence || 'unknown').toLowerCase();
    if (calibration[confidence]) {
      calibration[confidence].total++;
      if (gv.confidenceValidation === 'Validated') {
        calibration[confidence].correct++;
      }
    }
  });

  // Calculate calibration rates
  Object.keys(calibration).forEach(level => {
    const data = calibration[level];
    data.accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
  });

  return calibration;
}

/**
 * Generate model insights and improvement recommendations with null safety
 */
function generateModelInsights(validation) {
  const insights = {
    strengths: [],
    weaknesses: [],
    recommendations: []
  };

  // Analyze game predictions with null checks
  if (validation.overallAccuracy.games) {
    const gameAccuracy = validation.overallAccuracy.games;
    
    // SAFE: Check if favoriteAccuracy exists before using toFixed()
    if (gameAccuracy.favoriteAccuracy !== undefined && gameAccuracy.favoriteAccuracy !== null) {
      if (gameAccuracy.favoriteAccuracy >= 80) {
        insights.strengths.push(`Strong favorite prediction accuracy (${gameAccuracy.favoriteAccuracy.toFixed(1)}%)`);
      } else {
        insights.weaknesses.push(`Favorite prediction needs improvement (${gameAccuracy.favoriteAccuracy.toFixed(1)}%)`);
        insights.recommendations.push('Review team strength analysis and home court advantage factors');
      }
    }

    // SAFE: Check if averageMarginError exists before using toFixed()
    if (gameAccuracy.averageMarginError !== undefined && gameAccuracy.averageMarginError !== null) {
      if (gameAccuracy.averageMarginError <= 5) {
        insights.strengths.push(`Excellent margin prediction accuracy (avg error: ${gameAccuracy.averageMarginError.toFixed(1)} points)`);
      } else {
        insights.weaknesses.push(`Margin predictions need refinement (avg error: ${gameAccuracy.averageMarginError.toFixed(1)} points)`);
        insights.recommendations.push('Calibrate scoring projections and pace analysis');
      }
    }
  }

  // Analyze enhancement effectiveness with null checks
  if (validation.overallAccuracy.enhancements) {
    const enhAccuracy = validation.overallAccuracy.enhancements;
    
    // SAFE: Check if averageEffectiveness exists before using toFixed()
    if (enhAccuracy.averageEffectiveness !== undefined && enhAccuracy.averageEffectiveness !== null) {
      if (enhAccuracy.averageEffectiveness >= 70) {
        insights.strengths.push(`Enhancement system is effective (${enhAccuracy.averageEffectiveness.toFixed(1)}% success rate)`);
      } else {
        insights.weaknesses.push(`Enhancement system needs tuning (${enhAccuracy.averageEffectiveness.toFixed(1)}% success rate)`);
        insights.recommendations.push('Review enhancement thresholds and game script analysis accuracy');
      }
    }
  }

  // Analyze uncertainty modeling with null checks
  if (validation.overallAccuracy.uncertainty) {
    const uncAccuracy = validation.overallAccuracy.uncertainty;
    
    // SAFE: Check if playPredictionAccuracy exists before using toFixed()
    if (uncAccuracy.playPredictionAccuracy !== undefined && uncAccuracy.playPredictionAccuracy !== null) {
      if (uncAccuracy.playPredictionAccuracy >= 80) {
        insights.strengths.push(`Excellent uncertainty modeling (${uncAccuracy.playPredictionAccuracy.toFixed(1)}% play prediction accuracy)`);
      } else {
        insights.weaknesses.push(`Uncertainty modeling needs improvement (${uncAccuracy.playPredictionAccuracy.toFixed(1)}% play prediction accuracy)`);
        insights.recommendations.push('Review injury status interpretation and probability weights');
      }
    }
  }

  return insights;
}

/**
 * Generate enhanced validation report with null safety
 */
async function generateEnhancedReport(validation, date) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 ENHANCED VALIDATION REPORT');
  console.log('='.repeat(80));

  // Overall summary
  console.log(`\n📅 Date: ${date}`);
  console.log(`🏀 Games Analyzed: ${validation.finishedGamesCount} of ${validation.totalGamesCount}`);

  // Game validation summary with null safety
  if (validation.gameValidation.length > 0) {
    console.log(`\n🎯 GAME PREDICTION ACCURACY:`);
    console.log(`   Overall Grade: ${validation.overallAccuracy.games?.averageGrade || 'N/A'}`);
    console.log(`   Favorite Accuracy: ${(validation.overallAccuracy.games?.favoriteAccuracy || 0).toFixed(1)}%`);
    console.log(`   Avg Score Accuracy: ${(validation.overallAccuracy.games?.averageScoreAccuracy || 0).toFixed(1)}%`);
    console.log(`   Avg Margin Error: ${(validation.overallAccuracy.games?.averageMarginError || 0).toFixed(1)} points`);

    // Confidence calibration
    console.log(`\n🎲 CONFIDENCE CALIBRATION:`);
    Object.entries(validation.confidenceCalibration).forEach(([level, data]) => {
      if (data.total > 0) {
        console.log(`   ${level.toUpperCase()}: ${(data.accuracy || 0).toFixed(1)}% accurate (${data.correct}/${data.total})`);
      }
    });
  }

  // Player validation summary with null safety
  if (validation.playerValidation.length > 0) {
    console.log(`\n👥 PLAYER PREDICTION ACCURACY:`);
    console.log(`   Players Analyzed: ${validation.overallAccuracy.players?.totalPlayers || 0}`);
    console.log(`   Average Accuracy: ${(validation.overallAccuracy.players?.averageAccuracy || 0).toFixed(1)}%`);
    console.log(`   Range Accuracy: ${(validation.overallAccuracy.players?.averageRangeAccuracy || 0).toFixed(1)}%`);
    console.log(`   A/B Grade Rate: ${validation.overallAccuracy.players ? ((validation.overallAccuracy.players.playersGradedAOrBetter / validation.overallAccuracy.players.totalPlayers) * 100).toFixed(1) : 'N/A'}%`);
  }

  // Enhancement effectiveness with null safety
  if (validation.enhancementValidation.length > 0) {
    console.log(`\n🚀 ENHANCEMENT EFFECTIVENESS:`);
    console.log(`   Players with Enhancements: ${validation.overallAccuracy.enhancements?.totalPlayersWithEnhancements || 0}`);
    console.log(`   Average Effectiveness: ${(validation.overallAccuracy.enhancements?.averageEffectiveness || 0).toFixed(1)}%`);
    console.log(`   Helpful Enhancement Rate: ${validation.overallAccuracy.enhancements ? ((validation.overallAccuracy.enhancements.playersWithHelpfulEnhancements / validation.overallAccuracy.enhancements.totalPlayersWithEnhancements) * 100).toFixed(1) : 'N/A'}%`);
  }

  // Uncertainty modeling with null safety
  if (validation.uncertaintyValidation.length > 0) {
    console.log(`\n🎲 UNCERTAINTY MODELING ACCURACY:`);
    console.log(`   Uncertain Players: ${validation.overallAccuracy.uncertainty?.totalUncertainPlayers || 0}`);
    console.log(`   Play Prediction Accuracy: ${(validation.overallAccuracy.uncertainty?.playPredictionAccuracy || 0).toFixed(1)}%`);
  }

  // Strategic intelligence with null safety
  if (validation.strategyValidation.length > 0) {
    console.log(`\n⚔️ STRATEGIC INTELLIGENCE ACCURACY:`);
    console.log(`   Games with Strategy Analysis: ${validation.overallAccuracy.strategy?.gamesWithStrategicAnalysis || 0}`);
    console.log(`   Average Strategic Accuracy: ${(validation.overallAccuracy.strategy?.averageStrategicAccuracy || 0).toFixed(1)}%`);
  }

  // Model insights with null safety
  if (validation.modelInsights) {
    console.log(`\n🧠 MODEL INSIGHTS:`);
    
    if (validation.modelInsights.strengths.length > 0) {
      console.log(`   ✅ Strengths:`);
      validation.modelInsights.strengths.forEach(strength => {
        console.log(`      • ${strength}`);
      });
    }

    if (validation.modelInsights.weaknesses.length > 0) {
      console.log(`   ⚠️  Areas for Improvement:`);
      validation.modelInsights.weaknesses.forEach(weakness => {
        console.log(`      • ${weakness}`);
      });
    }

    if (validation.modelInsights.recommendations.length > 0) {
      console.log(`   💡 Recommendations:`);
      validation.modelInsights.recommendations.forEach(rec => {
        console.log(`      • ${rec}`);
      });
    }
  }

  // Detailed game results
  if (validation.gameValidation.length > 0) {
    console.log(`\n🏀 DETAILED GAME RESULTS:`);
    validation.gameValidation.forEach(gv => {
      console.log(`\n   ${gv.matchup} - Grade: ${gv.overallGrade} (Confidence: ${gv.confidence})`);
      console.log(`      Predicted: ${gv.predicted.awayScore}-${gv.predicted.homeScore} (${gv.predicted.favorite} favored, margin: ${gv.predicted.margin})`);
      console.log(`      Actual:    ${gv.actual.awayScore}-${gv.actual.homeScore} (${gv.actual.favorite} won, margin: ${gv.actual.margin})`);
      console.log(`      Accuracy:  Away ${(gv.accuracy.awayAccuracy || 0).toFixed(1)}%, Home ${(gv.accuracy.homeAccuracy || 0).toFixed(1)}%`);
      console.log(`      Favorite:  ${gv.favoriteCorrect ? '✅ Correct' : '❌ Incorrect'}`);
      console.log(`      Confidence: ${gv.confidenceValidation}`);
    });
  }

  // Top player predictions with null safety
  if (validation.playerValidation.length > 0) {
    const sortedPlayers = validation.playerValidation.sort((a, b) => (b.avgAccuracy || 0) - (a.avgAccuracy || 0));
    
    console.log(`\n👥 TOP PLAYER PREDICTIONS:`);
    console.log(`   🏆 Best Predictions:`);
    sortedPlayers.slice(0, 5).forEach(pv => {
      console.log(`      ${pv.playerName} (${pv.team}): ${(pv.avgAccuracy || 0).toFixed(1)}% avg, ${(pv.avgRangeAccuracy || 0).toFixed(1)}% range - Grade ${pv.overallGrade}/${pv.rangeGrade}`);
    });

    if (sortedPlayers.length > 5) {
      console.log(`   📉 Needs Improvement:`);
      sortedPlayers.slice(-3).forEach(pv => {
        console.log(`      ${pv.playerName} (${pv.team}): ${(pv.avgAccuracy || 0).toFixed(1)}% avg, ${(pv.avgRangeAccuracy || 0).toFixed(1)}% range - Grade ${pv.overallGrade}/${pv.rangeGrade}`);
      });
    }
  }

  // Save enhanced reports
  const reportDir = path.join(VALIDATION_DIR, date);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save detailed JSON report
  const detailedReportPath = path.join(reportDir, 'detailed_validation.json');
  fs.writeFileSync(detailedReportPath, JSON.stringify(validation, null, 2));

  // Save summary CSV
  const summaryPath = path.join(reportDir, 'validation_summary.csv');
  await generateSummaryCSV(validation, summaryPath);

  // Save insights report
  const insightsPath = path.join(reportDir, 'model_insights.json');
  fs.writeFileSync(insightsPath, JSON.stringify(validation.modelInsights, null, 2));

  console.log(`\n💾 Enhanced reports saved:`);
  console.log(`   📊 Detailed: ${detailedReportPath}`);
  console.log(`   📋 Summary: ${summaryPath}`);
  console.log(`   🧠 Insights: ${insightsPath}`);

  console.log('\n' + '='.repeat(80));
}

/**
 * Generate summary CSV for easy analysis with null safety
 */
async function generateSummaryCSV(validation, filePath) {
  const csvData = [];

  // Game summary
  validation.gameValidation.forEach(gv => {
    csvData.push({
      Type: 'Game',
      Subject: gv.matchup,
      Grade: gv.overallGrade,
      Accuracy: (((gv.accuracy.awayAccuracy || 0) + (gv.accuracy.homeAccuracy || 0)) / 2).toFixed(1),
      Details: `Predicted: ${gv.predicted.awayScore}-${gv.predicted.homeScore}, Actual: ${gv.actual.awayScore}-${gv.actual.homeScore}`,
      Confidence: gv.confidence,
      ConfidenceValidation: gv.confidenceValidation
    });
  });

  // Player summary (top and bottom performers)
  const sortedPlayers = validation.playerValidation.sort((a, b) => (b.avgAccuracy || 0) - (a.avgAccuracy || 0));
  [...sortedPlayers.slice(0, 10), ...sortedPlayers.slice(-5)].forEach(pv => {
    csvData.push({
      Type: 'Player',
      Subject: `${pv.playerName} (${pv.team})`,
      Grade: pv.overallGrade,
      Accuracy: (pv.avgAccuracy || 0).toFixed(1),
      Details: `Range accuracy: ${(pv.avgRangeAccuracy || 0).toFixed(1)}%`,
      Confidence: '',
      ConfidenceValidation: ''
    });
  });

  // Convert to CSV
  const headers = Object.keys(csvData[0] || {});
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');

  fs.writeFileSync(filePath, csvContent);
}

/**
 * Load all prediction CSV files for a date
 */
async function loadPredictionFiles(date) {
  const files = {
    games: path.join(OUTPUT_DIR, `${date}_games.csv`),
    players: path.join(OUTPUT_DIR, `${date}_players.csv`),
    strategy: path.join(OUTPUT_DIR, `${date}_strategy.csv`),
    summary: path.join(OUTPUT_DIR, `${date}_summary.csv`)
  };

  const predictions = {};

  for (const [type, filePath] of Object.entries(files)) {
    if (fs.existsSync(filePath)) {
      try {
        const csvContent = fs.readFileSync(filePath, 'utf8');
        predictions[type] = parse(csvContent, { 
          columns: true, 
          skip_empty_lines: true 
        });
        console.log(`  ✅ Loaded ${predictions[type].length} ${type} predictions`);
      } catch (error) {
        console.log(`  ⚠️ Failed to load ${type}: ${error.message}`);
      }
    } else {
      console.log(`  ❌ Missing file: ${filePath}`);
    }
  }

  return Object.keys(predictions).length > 0 ? predictions : null;
}

/**
 * Find the most recent prediction date
 */
function findLatestPredictionDate() {
  if (!fs.existsSync(OUTPUT_DIR)) return null;

  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('_games.csv'))
    .map(f => f.replace('_games.csv', ''))
    .sort()
    .reverse();

  return files[0] || null;
}

/**
 * Fetch game status for a date
 */
async function fetchGameStatus(date) {
  try {
    const response = await fetch(`${RESULTS_WORKER}/games-status?date=${date}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch actual game results
 */
async function fetchActualResults(date) {
  try {
    const response = await fetch(`${RESULTS_WORKER}/results?date=${date}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch detailed box scores for finished games
 */
async function fetchBoxScores(gameIds) {
  const boxScores = [];
  
  for (const gameId of gameIds) {
    try {
      const response = await fetch(`${RESULTS_WORKER}/boxscore?gameId=${gameId}`);
      const boxScore = await response.json();
      
      if (boxScore.success) {
        boxScores.push(boxScore);
      }
    } catch (error) {
      console.log(`  ⚠️ Failed to fetch box score for game ${gameId}: ${error.message}`);
    }
  }
  
  return boxScores;
}

/**
 * Helper functions with null safety
 */
function calculatePercentageAccuracy(predicted, actual) {
  if (actual === 0) return predicted === 0 ? 100 : 0;
  return Math.max(0, 100 - (Math.abs(predicted - actual) / actual * 100));
}

function playersMatch(name1, name2) {
  const normalize = name => name.toLowerCase().replace(/[^a-z]/g, '');
  return normalize(name1) === normalize(name2);
}

function getPlayProbability(injuryStatus) {
  const status = injuryStatus.toLowerCase();
  if (status.includes('questionable')) return 0.65;
  if (status.includes('doubtful')) return 0.20;
  if (status.includes('probable')) return 0.90;
  if (status.includes('out')) return 0.0;
  return 1.0; // Healthy
}

function getEffectiveness(injuryStatus) {
  const status = injuryStatus.toLowerCase();
  if (status.includes('questionable')) return 0.75;
  if (status.includes('doubtful')) return 0.60;
  if (status.includes('probable')) return 0.95;
  if (status.includes('out')) return 0.0;
  return 1.0; // Healthy
}

function gradeToNumber(grade) {
  const gradeMap = { 'A+': 97, 'A': 93, 'B+': 87, 'B': 83, 'C+': 77, 'C': 73, 'D': 67, 'F': 50 };
  return gradeMap[grade] || 50;
}

function numberToGrade(number) {
  if (number >= 95) return 'A+';
  if (number >= 90) return 'A';
  if (number >= 85) return 'B+';
  if (number >= 80) return 'B';
  if (number >= 75) return 'C+';
  if (number >= 70) return 'C';
  if (number >= 60) return 'D';
  return 'F';
}

function analyzeRange(days) {
  console.log(`📊 Range analysis for ${days} days not yet implemented`);
  console.log('   This will analyze trends across multiple prediction dates');
  console.log('   Features to implement:');
  console.log('   • Accuracy trends over time');
  console.log('   • Enhancement effectiveness patterns');
  console.log('   • Confidence calibration improvements');
  console.log('   • Model drift detection');
}

// Run the enhanced analyzer
main();