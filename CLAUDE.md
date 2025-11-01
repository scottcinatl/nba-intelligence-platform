# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NBA Intelligence Platform - A professional-grade NBA prediction and validation system that combines official NBA data, team style analysis, injury intelligence, and game script analysis to deliver institutional-quality basketball analytics.

**Core Value**: Transforms basketball data into strategic intelligence through multi-layer enhancement models and probability-weighted uncertainty modeling.

## Common Commands

### Running Predictions
```bash
# Generate predictions for today's games
npm run predict
# or
node prediction-engine/prediction-engine.js

# Quick scan mode (faster, less detail)
node prediction-engine/prediction-engine.js --quick

# Analyze specific game
node prediction-engine/prediction-engine.js --game=ORL-CHA
```

### Validating Results
```bash
# Validate most recent predictions
npm run validate
# or
node results-validation/validator.js --latest

# Validate specific date
npm run validate-date
# or
node results-validation/validator.js 2025-10-30
```

### Setup
```bash
# Install dependencies
npm install
# or
npm run setup
```

## High-Level Architecture

### System Design Philosophy
The platform implements a **six-layer enhancement model** that transforms basic player statistics into contextually-aware projections:

1. **Player Impact Tier** - Classifies players as Superstar/Star/Key Role/Bench based on impact score
2. **Position Intelligence** - Uses official NBA position data for role-specific advantages
3. **Team Style Integration** - Analyzes pace, shooting patterns, and system preferences
4. **Game Script Analysis** - Identifies strategic battles (Interior/Perimeter/Tempo)
5. **Injury Intelligence** - Probability-weighted projections using industry-standard status interpretation
6. **Teammate Opportunities** - Conditional adjustments when star players are out/questionable

### Data Flow Pipeline
```
NBA APIs → Cloudflare Workers → Enhancement Layers → Strategic Analysis → CSV Output
                ↓                         ↓                    ↓
         Cache & CORS          Multi-Layer Model      Validation System
```

### Key Components

#### 1. Cloudflare Workers (./workers/)
- **Purpose**: Bypass NBA API rate limits and bot detection
- **Critical**: All workers use specific NBA headers to simulate browser requests - **NEVER modify these headers**
- **Workers**:
  - `nba-worker-players.js` - Player stats with official position data
  - `nba-worker-teams.js` - Team statistics (general, advanced, opponent)
  - `nba-worker-teamstyle.js` - Team style profiling (pace, shooting, system)
  - `nba-worker-lineups.js` - 5-man lineup combinations and effectiveness
  - `nba-worker-injuries-official.js` - Official NBA injury report PDFs
  - `nba-worker-gamenotes.js` - Team-specific game notes
  - `nba-worker-results.js` - Game results and box scores for validation

#### 2. Prediction Engine (./prediction-engine/)
- **Main**: `prediction-engine.js` - Orchestrates entire prediction pipeline
- **Output**: 4 CSV files per run in `./prediction-engine/output/`:
  - `YYYY-MM-DD_games.csv` - Game predictions with strategic analysis
  - `YYYY-MM-DD_players.csv` - Player projections with enhancement tracking
  - `YYYY-MM-DD_strategy.csv` - Game script insights and tactical recommendations
  - `YYYY-MM-DD_summary.csv` - Executive summary format

#### 3. Validation System (./results-validation/)
- **Main**: `validator.js` - Multi-dimensional validation framework
- **Output**: Validation reports in `./validation/YYYY-MM-DD/`:
  - `detailed_validation.json` - Complete validation data
  - `model_insights.json` - Structured improvement recommendations
- **Validates**:
  - Game-level accuracy (scores, margins, favorites, confidence calibration)
  - Player-level accuracy (range validation, enhancement effectiveness)
  - Strategic intelligence (game script predictions, tactical recommendations)
  - Uncertainty modeling (injury status probability weighting)

#### 4. Documentation (./docs/)
- `system-architecture.md` - Comprehensive system overview and roadmap
- `nba-workers-documentation.md` - Detailed worker API reference
- `player-projection-decision-framework.md` - Enhancement model mathematics
- `results-validation-system.md` - Validation methodology and metrics

### Critical Implementation Details

#### Injury Status Probability Weighting
```javascript
// Industry-standard interpretation
'questionable': { playProbability: 0.65, effectiveness: 0.75 }
'doubtful': { playProbability: 0.20, effectiveness: 0.60 }
'probable': { playProbability: 0.90, effectiveness: 0.95 }
'out': { playProbability: 0.0, effectiveness: 0.0 }

// Expected value calculation
expectedPoints = basePoints * playProbability * effectiveness
```

#### Impact Score Classification
```javascript
impactScore = points*1.0 + assists*1.5 + rebounds*1.2 + steals*2.0 + blocks*2.0

// Tier thresholds
Superstar: 40+ impact (15-20% boost in opportunity situations)
Star: 25-40 impact (10-15% boost)
Key Role: 15-25 impact (5-8% boost)
Bench: <15 impact (minimal adjustments)
```

#### Game Script Battle Detection
```javascript
// Statistical mismatch detection (5+ point differentials)
Interior Battle: Paint points differential >= 5.0
Perimeter Battle: 3P% differential >= 4.0
Tempo Control: Pace differential >= 3.0
```

### Position Mapping
The system uses official NBA position data with smart compound position handling:
- Single positions: PG, SG, SF, PF, C
- Compound positions: G (→ SG), F (→ SF), G-F (→ SG), F-G (→ SF), F-C (→ PF), C-F (→ C)

### CSV Output Format
All CSV files are optimized for Google Sheets:
- Clean numbers (no units, formula-ready)
- Y/N indicators instead of booleans
- Range formats like "26-32" for projections
- Enhancement tracking (Base vs Enhanced columns)

### Environment Requirements
- **Node.js**: >= 18.0.0
- **Module Type**: ESM (type: "module" in package.json)
- **Dependencies**: csv-parse, pdf-parse

### Worker API Patterns

#### Common Parameters
- `season`: Format "2025-26" (calculated: Oct-Dec uses current-next, Jan-Sep uses previous-current)
- `lastN`: Number of recent games to analyze (typically 5-10)
- `team`: NBA team ID (e.g., "1610612738" for Boston Celtics)
- `date`: Format "YYYY-MM-DD"

#### Standard Response Format
```javascript
{
  success: true|false,
  data: {...},
  error?: "error message",
  timestamp: "ISO-8601 timestamp"
}
```

## Development Guidelines

### When Modifying Enhancement Model
1. Update calculations in `prediction-engine.js`
2. Document changes in `docs/player-projection-decision-framework.md`
3. Run validation to measure impact: `npm run validate`
4. Compare enhancement effectiveness before/after changes

### When Adding New Workers
1. Follow standard CORS and NBA headers patterns from existing workers
2. Implement consistent error handling with detailed messages
3. Add 5-minute cache TTL (`cacheTtl: 300`)
4. Document endpoint in `docs/nba-workers-documentation.md`
5. Update WORKERS object in `prediction-engine.js`

### When Debugging Predictions
1. Check worker responses first - they may be rate-limited
2. Verify NBA API hasn't changed response format
3. Look for null/undefined data in player or team stats
4. Check PDF parsing if injury data looks wrong
5. Run with `--quick` flag to isolate data fetching issues

### Testing Worker Changes
Deploy to Cloudflare Workers and test endpoints directly:
```bash
# Test worker health
curl https://nba-worker-teams.scottcinatl.workers.dev/test

# Test with parameters
curl "https://nba-worker-teams.scottcinatl.workers.dev/teams?id=1610612738&season=2025-26&lastN=10"
```

## Known Patterns and Conventions

### File Naming
- Prediction outputs: `YYYY-MM-DD_[games|players|strategy|summary].csv`
- Validation outputs: `YYYY-MM-DD/[detailed_validation|model_insights].json`

### Error Handling
Workers and prediction engine both use defensive coding:
- Null checks before accessing nested properties
- Fallback values for missing data
- Detailed error messages with troubleshooting hints

### Season Calculation Helper
```javascript
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
```

## Project Philosophy

**"Turning basketball data into strategic intelligence"**

This system doesn't just predict scores - it provides **strategic advisory** explaining:
- **What** might happen (predictions)
- **Why** it might happen (game script analysis)
- **What teams should do** (tactical recommendations)
- **How confident we are** (probability-weighted uncertainty)

The goal is institutional-quality analysis suitable for professional environments while remaining accessible for individual use.
