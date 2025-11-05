# Parlay Builder Strategy

**Last Updated:** 2025-11-02
**Status:** Initial Planning Phase
**Goal:** Build tool to identify 10-20 high-confidence NBA prop bets per night for small-stake, high-reward parlays

---

## Executive Summary

Unlike traditional +EV betting tools, this system focuses on **identifying the most confident predictions** across a full NBA slate and chaining them into multi-leg parlays. By risking only $0.13-$1.00 per bet, we create asymmetric risk/reward opportunities (e.g., $0.13 → $245,000).

**Core Insight:** We're not trying to beat the house on every bet. We're trying to find the 10-20 **safest** bets each night where our model has the highest confidence.

---

## Mathematical Foundation

### Parlay Hit Probability
For a parlay to succeed, ALL legs must hit:
```
Parlay Success Rate = Leg1 × Leg2 × Leg3 × ... × LegN
```

**Target Scenarios:**
- 15 legs at 92% confidence each → 29% parlay hit rate
- 20 legs at 90% confidence each → 12% parlay hit rate

**Key Insight:** Even if our "90% confidence" legs are actually 85% (books are good), we still have positive EV on massive payouts:
- 0.85^15 = 8.7% hit rate on a 500:1 payout = +4,250% expected ROI

### Required Individual Leg Confidence
To achieve different parlay hit rates:
```
10 legs → need 87% per leg for 25% parlay success
15 legs → need 92% per leg for 29% parlay success
20 legs → need 95% per leg for 36% parlay success
```

**Conclusion:** We need to be VERY selective. Only include legs where our model is extremely confident.

---

## Strategy Framework

### Tier 1: Ultra-Safe Legs (95%+ Confidence)
**Ideal Candidates:**
- Star players in favorable matchups
  - Example: Giannis Over 25.5 pts vs weak interior defense
- Players with consistent high floors
  - Example: Sabonis Over 11.5 rebounds (hits 85%+ of games)
- Team totals against weak defenses
  - Example: Warriors Team Total Over 110.5 vs Wizards

**Model Criteria:**
- Player variance < 15%
- No injury concerns (status = "healthy")
- Historical hit rate > 80% for similar lines
- Matchup rating = "favorable"
- 2+ standard deviations below our projection

### Tier 2: High-Confidence Legs (90%+ Confidence)
**Ideal Candidates:**
- Role players in defined, stable roles
- Game totals for high-pace matchups
- Assist props for primary ball handlers

**Model Criteria:**
- Player variance < 20%
- Stable minutes/role
- 1.5+ standard deviations below our projection
- Historical hit rate > 75%

### Tier 3: AVOID These Legs
**Never Include:**
- ❌ Questionable/Doubtful injury status players
- ❌ Same-game correlations (Giannis Over + Bucks ML)
- ❌ Bench players with inconsistent minutes
- ❌ Three-point props (high variance)
- ❌ Games with major injury uncertainty
- ❌ Players in blowout-prone games (garbage time risk)

---

## Data Sources

### Our Prediction Engine
**What We Already Have:**
- Player projections (points, rebounds, assists)
- Confidence intervals (68% and 95% ranges)
- Variance modeling
- Injury status tracking
- Matchup analysis
- Team style analysis

**What We Can Add:**
- Historical hit rate tracking
- "Confidence score" for each projection
- Same-game correlation detection

### DraftKings Props
**What We Need to Scrape:**
- Player points (Over/Under)
- Player rebounds (Over/Under)
- Player assists (Over/Under)
- Player combos (PRA - Points + Rebounds + Assists)
- Team totals (Over/Under)
- Game totals (Over/Under)

**Implementation:**
- Build Cloudflare Worker to scrape DK odds pages
- Use same NBA header patterns as existing workers
- Cache for 15-30 minutes to reduce requests
- Parse HTML to extract lines and odds

**Alternative:**
- The-Odds-API.com (500 free requests/month)
- Cleaner data but limited free tier
- Could be used as backup/validation

---

## Parlay Builder Rules

### Rule 1: Spread Across Games
**Goal:** Reduce correlation risk
```
✅ 4 legs from Game 1, 4 from Game 2, 4 from Game 3, etc.
❌ 10 legs all from Lakers vs Celtics
```

**Implementation:**
```javascript
maxLegsPerGame = Math.ceil(totalLegs / numberOfGames)
// For 15 legs across 6 games = max 3 per game
```

### Rule 2: Diversify Bet Types
**Goal:** Avoid correlated outcomes
```
✅ Mix points, rebounds, assists, team totals
❌ All point overs (correlated with pace)
```

### Rule 3: Prioritize Stars Over Role Players
**Goal:** Reduce minutes/usage volatility
```
✅ Giannis, Tatum, Doncic (predictable roles)
❌ 7th man off the bench (volatile minutes)
```

### Rule 4: Use Variance as Tiebreaker
**Formula:**
```javascript
confidenceScore = (projection - line) / variance
// Higher score = safer bet
```

### Rule 5: No Same-Player Correlations
**Avoid:**
- Same player, multiple stats (Giannis Pts + Giannis Rebs)
- Player prop + same-game team result (Tatum Over + Celtics ML)

---

## Implementation Phases

### Phase 1: Data Collection (Week 1)
**Goal:** Build infrastructure and gather comparison data

**Tasks:**
- [ ] Build DraftKings scraper worker
- [ ] Parse props: Points, Rebounds, Assists, PRA combos
- [ ] Create comparison CSV: Projection vs DK Line
- [ ] Add confidence scoring to each prop
- [ ] Test worker with actual DK pages

**Output:**
```csv
Date,Player,Stat,DKLine,OurProjection,Variance,ConfidenceScore,Tier
2025-11-05,Giannis,Points,28.5,31.2,2.7,0.94,Ultra-Safe
2025-11-05,Tatum,Rebounds,7.5,8.2,1.8,0.68,Avoid
```

### Phase 2: Leg Ranker (Week 2)
**Goal:** Build confidence scoring algorithm

**Tasks:**
- [ ] Implement confidence calculation
- [ ] Add historical hit rate tracking
- [ ] Filter by injury status
- [ ] Apply variance thresholds
- [ ] Rank all available props

**Confidence Score Algorithm:**
```javascript
function scoreConfidence(projection, line, variance, context) {
  const edge = projection - line;
  const standardDevs = edge / variance;

  // Disqualifiers
  if (context.injuryStatus !== 'healthy') return 0;
  if (variance > 0.20) return 0;  // Too volatile
  if (context.minutesConfidence < 0.8) return 0;

  // Base confidence from normal distribution
  let confidence = normalCDF(standardDevs);

  // Adjust for historical accuracy
  confidence *= context.historicalHitRate;

  // Boost for favorable context
  if (context.matchupRating === 'favorable') confidence *= 1.05;

  return Math.min(confidence, 0.99); // Cap at 99%
}
```

**Output:**
- Top 50 ranked props per night
- Confidence tier classification
- Reasoning for each rating

### Phase 3: Parlay Optimizer (Week 2-3)
**Goal:** Build automated parlay assembly

**Tasks:**
- [ ] Implement diversification rules
- [ ] Detect and avoid correlations
- [ ] Build multiple parlay options (conservative, balanced, aggressive)
- [ ] Calculate expected hit rate and payout

**Optimizer Logic:**
```javascript
function buildOptimalParlay(rankedLegs, targetSize = 15) {
  const selected = [];
  const maxPerGame = Math.ceil(targetSize / numberOfGames);
  const usedPlayers = new Set();

  for (const leg of rankedLegs) {
    if (selected.length >= targetSize) break;

    // Check diversification rules
    if (countLegsFromGame(selected, leg.gameId) >= maxPerGame) continue;
    if (usedPlayers.has(leg.playerName)) continue; // No multi-stat same player
    if (hasCorrelatedBet(selected, leg)) continue;

    selected.push(leg);
    usedPlayers.add(leg.playerName);
  }

  return {
    legs: selected,
    expectedHitRate: selected.reduce((p, leg) => p * leg.confidence, 1),
    totalConfidence: calculateOverallConfidence(selected),
    estimatedPayout: calculateParlayOdds(selected)
  };
}
```

**Output Formats:**
1. **Conservative Parlay** - 10 legs, 95%+ each
2. **Balanced Parlay** - 15 legs, 92%+ each
3. **Aggressive Parlay** - 20 legs, 90%+ each

### Phase 4: Validation & Tracking (Ongoing)
**Goal:** Learn from results and improve model

**Tasks:**
- [ ] Paper trade for 10-15 days before real money
- [ ] Track individual leg hit rates by tier
- [ ] Track parlay success rates
- [ ] Identify patterns in misses
- [ ] Refine confidence scoring based on results

**Tracking Schema:**
```javascript
{
  date: "2025-11-05",
  parlays: [
    {
      id: "conservative-001",
      stake: 1.00,
      legs: 10,
      legsHit: 9,
      legsMissed: 1,
      result: "LOSS",
      potentialPayout: 25000,
      actualPayout: 0,
      missedLegs: [
        {
          player: "Jayson Tatum",
          bet: "Over 7.5 rebounds",
          actual: 7,
          reasoning: "Blowout win, sat 4th quarter"
        }
      ]
    }
  ],
  insights: [
    "Rebound props in potential blowouts are risky",
    "Ultra-Safe tier hit at 91% (expected 95%)",
    "High-Confidence tier hit at 87% (expected 90%)"
  ]
}
```

---

## Success Metrics

### Individual Leg Performance
**Targets:**
- Ultra-Safe tier: 95%+ hit rate
- High-Confidence tier: 90%+ hit rate
- Overall average: 92%+ hit rate

**If Below Targets:**
- Tighten confidence thresholds
- Analyze miss patterns
- Adjust for blind spots (blowouts, rest games, etc.)

### Parlay Performance
**Targets (15-leg parlays):**
- Expected hit rate: 25-30%
- Actual hit rate: 20-25% (accounting for model error)
- Long-term ROI: Positive (even at 10% hit rate on 500:1 odds)

**Break-Even Analysis:**
```
15-leg parlay typical odds: +50000 (500:1 payout)
Break-even hit rate: 1/500 = 0.2%

If we achieve 10% hit rate → 50x expected ROI
If we achieve 20% hit rate → 100x expected ROI
```

### Model Calibration
Track by tier:
```
If "95% confidence" legs hit 95% → Model is well-calibrated
If "95% confidence" legs hit 85% → Model is overconfident (adjust down)
If "95% confidence" legs hit 98% → Model is underconfident (can be more aggressive)
```

---

## Key Risks & Mitigations

### Risk 1: Overconfidence
**Problem:** Our model thinks 95% confidence but actually 85%

**Mitigation:**
- Paper trade for 10-15 days first
- Track calibration by confidence tier
- Adjust thresholds based on actual results
- Start conservative, loosen only if hitting targets

### Risk 2: Correlation Blind Spots
**Problem:** We think bets are independent but they're correlated

**Examples:**
- High-scoring game → multiple players go over points
- Blowout → starters sit 4th quarter, miss props
- Foul trouble → rotation changes, impacts multiple players

**Mitigation:**
- Spread across multiple games
- Avoid same-game player stacks
- Build correlation detection into optimizer
- Track correlation patterns in losses

### Risk 3: DraftKings Limits/Restrictions
**Problem:** Books limit/ban winning players

**Reality Check:**
- $1 parlays won't trigger limits immediately
- We're betting props, not sides/totals (less scrutiny)
- If this becomes a problem, it means we're winning

**Mitigation:**
- Keep stakes small ($0.13-$1.00)
- Don't bet every day if possible
- Could spread across multiple books eventually

### Risk 4: Sample Size / Variance
**Problem:** Even 30% hit rate means 70% losses

**Reality:**
- Will lose 7-9 parlays out of 10
- Streaks happen: could go 0/20 early
- Emotional discipline required

**Mitigation:**
- Set strict bankroll limits
- View as entertainment with lottery upside
- Track long-term results (100+ parlays)
- Don't chase losses

---

## Technical Architecture (Preliminary)

### New Components Needed

**1. DraftKings Scraper Worker**
```
Location: /workers/nba-worker-draftkings.js
Endpoint: https://nba-worker-draftkings.scottcinatl.workers.dev
Parameters: ?date=YYYY-MM-DD&types=points,rebounds,assists,pra
Response: { success, props: [{player, stat, line, odds}], timestamp }
```

**2. Parlay Builder Engine**
```
Location: /parlay-builder/parlay-builder.js
Inputs: Our projections + DK lines
Outputs: Ranked legs + 3 parlay recommendations (conservative/balanced/aggressive)
```

**3. Confidence Scorer**
```
Location: /parlay-builder/modules/confidence-scorer.js
Function: Score each prop on 0-1 scale
Uses: Projection, variance, injury status, historical hit rate, matchup
```

**4. Parlay Optimizer**
```
Location: /parlay-builder/modules/parlay-optimizer.js
Function: Build optimal parlays with diversification rules
Uses: Ranked legs, correlation detection, game distribution
```

**5. Results Tracker**
```
Location: /parlay-builder/results/
Tracks: Daily parlay results, leg hit rates, model calibration
Outputs: Performance metrics, improvement recommendations
```

### Data Flow
```
1. Run prediction-engine.js → Generate player projections
2. Run draftkings-scraper → Fetch current lines
3. Run confidence-scorer.js → Score each available prop
4. Run parlay-optimizer.js → Build 3 parlay options
5. Output to CSV: parlays-YYYY-MM-DD.csv
6. (Optional) Submit bets to DraftKings manually
7. Next day: Run results-tracker.js → Compare actual vs predicted
```

---

## Open Questions (To Address Tuesday)

### Technical Questions
1. **DraftKings Scraping:**
   - What's the HTML structure of their props pages?
   - Do they have bot detection we need to bypass?
   - How often do lines update (determines cache strategy)?

2. **Historical Data:**
   - Do we scrape historical DK lines for calibration?
   - Or use our validation system's actual game results?

3. **Correlation Detection:**
   - How do we mathematically detect correlated bets?
   - Build a correlation matrix from historical data?

### Strategy Questions
1. **Parlay Size:**
   - Start with 10, 15, or 20 legs?
   - Test multiple sizes in parallel?

2. **Confidence Thresholds:**
   - Start conservative (95%+ only) or balanced (90%+)?
   - How many props typically meet each threshold per night?

3. **Bet Types:**
   - Focus only on points/rebounds/assists?
   - Include team totals, game totals?
   - Include PRA combos?

4. **Paper Trading Duration:**
   - 7 days? 15 days? Until we see stable calibration?

### Product Questions
1. **Output Format:**
   - CSV for manual entry?
   - Eventually build DK API integration for auto-submission?

2. **Daily Workflow:**
   - Run predictions in morning, optimize parlays, submit before first game?
   - Or run twice daily (early and close to game time for injury updates)?

3. **User Interface:**
   - Command-line tool?
   - Web dashboard?
   - Start simple, iterate?

---

## Next Steps (Tuesday, November 5)

### Immediate Actions
1. **Research DraftKings scraping:**
   - Inspect their props pages
   - Test if simple fetch works or if we need headless browser
   - Identify all available prop types

2. **Design confidence scoring:**
   - Define exact formula with weighted factors
   - Determine variance thresholds
   - Plan historical hit rate tracking

3. **Build Phase 1 MVP:**
   - DraftKings scraper worker
   - Simple comparison CSV
   - Manual confidence scoring (before automation)

4. **Paper trade setup:**
   - Design tracking spreadsheet
   - Define what metrics to capture
   - Plan daily workflow

### Week 1 Goal
By end of Week 1 (Nov 8), have:
- Working DK scraper
- Daily CSV comparing our projections to DK lines
- Manual parlay selections for paper trading
- 5-7 days of tracked results

### Week 2 Goal
By end of Week 2 (Nov 15), have:
- Automated confidence scoring
- Automated parlay builder
- 10-15 days of paper trading data
- Initial calibration insights

### Week 3 Decision Point
After 15-20 days of paper trading:
- If Ultra-Safe tier hitting 90%+ → Consider real money
- If below 85% → Refine model before betting
- If hitting 95%+ → We're too conservative, can be more aggressive

---

## Philosophy

**This is not gambling, it's applied mathematics with entertainment value.**

We're building a system to identify high-probability outcomes and compound them for asymmetric risk/reward. The small stakes ($0.13-$1.00) mean this is pure entertainment with lottery ticket upside.

**Success is:**
- Building a robust analytical system
- Learning about model calibration
- Validating our prediction engine
- (Bonus) Occasionally hitting a 20-leg parlay for $50k+

**Even if we never hit a big parlay**, the process of building this will make our core prediction engine dramatically better. That's the real win.

---

## Resources & References

### Similar Approaches
- Kelly Criterion for bankroll management
- Nate Silver's 538 model calibration methods
- Professional sports betting +EV finders

### Tools We Can Learn From
- Unabated.com (shows +EV opportunities)
- OddsJam (line shopping across books)
- Action Network (prop bet analysis)

### Academic Research
- "Probabilistic forecasting" (FiveThirtyEight methodology)
- "Wisdom of the crowd" vs expert models
- Correlation in sports betting markets

---

## Appendix: Example Parlay (Conceptual)

**Date:** November 5, 2025
**Type:** Conservative (15 legs, 95%+ confidence each)
**Stake:** $1.00
**Estimated Odds:** +50000 (500:1)
**Expected Hit Rate:** 29%

| # | Player | Stat | Line | Our Proj | Confidence | Game |
|---|--------|------|------|----------|------------|------|
| 1 | Giannis Antetokounmpo | Points Over | 28.5 | 31.2 | 94% | MIL vs SAC |
| 2 | Domantas Sabonis | Rebounds Over | 11.5 | 13.8 | 96% | SAC vs MIL |
| 3 | Luka Doncic | Assists Over | 8.5 | 10.1 | 93% | DAL vs DET |
| 4 | Jayson Tatum | Points Over | 24.5 | 27.3 | 92% | BOS vs HOU |
| 5 | Anthony Edwards | Points Over | 23.5 | 26.8 | 95% | MIN vs CHA |
| 6 | Warriors Team Total | Over | 110.5 | 115.2 | 91% | GSW vs IND |
| 7 | Tyrese Haliburton | Assists Over | 8.5 | 10.2 | 93% | IND vs GSW |
| 8 | Dejounte Murray | Assists Over | 5.5 | 7.1 | 94% | NOP vs CLE |
| 9 | Nikola Jokic | Rebounds Over | 11.5 | 13.1 | 95% | DEN vs OKC |
| 10 | Shai Gilgeous-Alexander | Points Over | 27.5 | 30.2 | 92% | OKC vs DEN |
| 11 | Joel Embiid | Points Over | 28.5 | 31.8 | 93% | PHI vs ATL |
| 12 | Trae Young | Assists Over | 10.5 | 11.9 | 91% | ATL vs PHI |
| 13 | Damian Lillard | Points Over | 22.5 | 25.3 | 92% | MIL vs SAC |
| 14 | Bucks Team Total | Over | 115.5 | 119.8 | 94% | MIL vs SAC |
| 15 | Warriors vs Pacers | Over | 230.5 | 235.1 | 91% | GSW vs IND |

**Diversification:**
- 6 different games
- Mix of player props (points/rebounds/assists) and team totals
- No same-player correlations
- Max 3 legs per game

**Expected Outcome:**
- Individual legs: Each 92-95% likely to hit
- Combined: 0.93^15 = 29% chance all hit
- Long-term: Hit ~1 in 3.5 parlays
- ROI: $500 × 0.29 = $145 expected value on $1 bet

---

*This document will be expanded and refined as we build the system. Last update: November 2, 2025*
