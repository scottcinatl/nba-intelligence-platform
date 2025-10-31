# NBA Cloudflare Workers Documentation

## Overview

This documentation covers a collection of NBA data Cloudflare Workers designed to bypass NBA API rate limits and bot detection while providing reliable access to NBA statistics, game data, and analysis.

## Why Cloudflare Workers?

### 1. **Bypass Rate Limits**
- NBA APIs aggressively rate limit direct requests
- Cloudflare Workers provide distributed IP addresses
- Built-in caching reduces API calls

### 2. **Bypass Bot Detection**
- NBA Stats API blocks requests without proper browser headers
- Workers can simulate legitimate browser requests
- Consistent User-Agent and referrer headers

### 3. **Reliability & Performance**
- Global edge network reduces latency
- Built-in error handling and retry logic
- Caching at edge locations

### 4. **CORS Support**
- Enable cross-origin requests from web applications
- Standardized CORS headers across all workers

## Worker Architecture

### Common Patterns

All workers follow these consistent patterns:

#### 1. **CORS Headers (Standard)**
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS', // or 'GET, POST, OPTIONS'
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Handle CORS preflight
if (request.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

#### 2. **NBA API Headers (Critical for bypassing bot detection)**
```javascript
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
```

#### 3. **Error Handling Pattern**
```javascript
try {
  // Worker logic
} catch (error) {
  console.error('Error:', error);
  
  return new Response(JSON.stringify({
    success: false,
    error: error.message,
    details: {
      possibleCauses: [
        'NBA API rate limiting',
        'Invalid parameters',
        'Network connectivity issues',
        'NBA API maintenance'
      ]
    }
  }), {
    status: 500,
    headers: corsHeaders
  });
}
```

#### 4. **Season Helper Function**
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

## Worker Catalog

### 1. **NBA Results Worker** (`nba-worker-results`)
**URL**: `https://nba-worker-results.scottcinatl.workers.dev`

**Purpose**: Fetch game results, scores, and box scores

**Endpoints**:
- `/results?date=YYYY-MM-DD` - Game results with scores
- `/boxscore?gameId=ID` - Detailed player statistics
- `/games-status?date=YYYY-MM-DD` - Game status (finished/ongoing)
- `/test` - Health check

**Key Features**:
- Multiple NBA API fallbacks for historical data
- Individual game score fetching
- Player box score parsing
- Game status detection

**Usage Example**:
```javascript
// Get game results for a specific date
const response = await fetch('https://nba-worker-results.scottcinatl.workers.dev/results?date=2025-10-30');
const data = await response.json();
```

---

### 2. **NBA Players Worker** (`nba-worker-players`)
**URL**: `https://nba-worker-players.scottcinatl.workers.dev`

**Purpose**: Fetch individual player statistics with position data

**Endpoints**:
- `/players?team=TEAMID&season=2025-26&lastN=5` - Team players
- `/players?id=PLAYERID&season=2025-26&lastN=5` - Individual player

**Key Features**:
- General + Advanced statistics merging
- Official NBA position data
- Player profile information (height, weight, experience)
- Team roster integration

**Usage Example**:
```javascript
// Get all players for a team
const response = await fetch('https://nba-worker-players.scottcinatl.workers.dev/players?team=1610612738&season=2025-26&lastN=10');
const data = await response.json();
```

---

### 3. **NBA Teams Worker** (`nba-worker-teams`)
**URL**: `https://nba-worker-teams.scottcinatl.workers.dev`

**Purpose**: Fetch comprehensive team statistics

**Endpoints**:
- `/teams?id=TEAMID&season=2025-26&lastN=5` - Team statistics

**Key Features**:
- General statistics (points, rebounds, assists)
- Advanced statistics (offensive/defensive rating, pace)
- Opponent statistics (defense metrics)
- Win/loss records and percentages

**Data Categories**:
- `general`: Basic team stats
- `advanced`: Advanced metrics (OffRtg, DefRtg, Pace)
- `opponent`: Defensive statistics

---

### 4. **NBA Team Style Worker** (`nba-worker-teamstyle`)
**URL**: `https://nba-worker-teamstyle.scottcinatl.workers.dev`

**Purpose**: Analyze team playing style and tendencies

**Endpoints**:
- `/profile?team=TEAMID&season=2024-25&lastN=10` - Team style profile

**Key Features**:
- Offensive style analysis (pace, shot selection, ball movement)
- Defensive style analysis (pressure, help defense)
- Situational tendencies (clutch time, blowouts)
- Advanced metrics correlation

**Style Categories**:
- `offensive`: Shot distribution, pace, ball movement
- `defensive`: Pressure, fouling, help defense
- `situational`: Home/away, clutch, blowout performance
- `advanced`: Efficiency ratings and correlations

---

### 5. **NBA Lineups Worker** (`nba-worker-lineups`)
**URL**: `https://nba-worker-lineups.scottcinatl.workers.dev`

**Purpose**: Fetch team lineup combinations and effectiveness

**Endpoints**:
- `/lineups?team=TEAMID&season=2024-25&lastN=10` - Team lineup stats

**Key Features**:
- 5-man lineup combinations
- Minutes played together
- Plus/minus ratings
- Shooting and advanced statistics
- Lineup effectiveness rankings

---

### 6. **NBA Injuries Worker** (`nba-worker-injuries-official`)
**URL**: `https://nba-worker-injuries-official.scottcinatl.workers.dev`

**Purpose**: Fetch official NBA injury reports

**Endpoints**:
- `/injuries?date=YYYY-MM-DD` - Official injury report

**Key Features**:
- Official NBA injury report PDFs
- Date-specific injury status
- League-wide injury information

---

### 7. **NBA Game Notes Worker** (`nba-worker-gamenotes`)
**URL**: `https://nba-worker-gamenotes.scottcinatl.workers.dev`

**Purpose**: Access team-specific game notes (PDF format)

**Endpoints**:
- `/gamenotes?team=TEAMABBR` - Team game notes

**Key Features**:
- Team-specific PDF game notes
- Pre-game information
- Injury updates and lineup news

## NBA API Endpoints Reference

### Common NBA Stats API Patterns

#### Player Statistics:
```
https://stats.nba.com/stats/leaguedashplayerstats?
  College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=
  &DraftYear=&GameScope=&GameSegment=&Height=&LastNGames={lastN}
  &LeagueID=00&Location=&MeasureType={Base|Advanced}&Month=0&OpponentTeamID=0
  &Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0
  &PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season={season}
  &SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=
  &StarterBench=&TeamID={teamId}&TwoWay=0&VsConference=&VsDivision=&Weight=
```

#### Team Statistics:
```
https://stats.nba.com/stats/leaguedashteamstats?
  Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=
  &LastNGames={lastN}&LeagueID=00&Location=&MeasureType={Base|Advanced|Opponent}
  &Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N
  &PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=
  &PlusMinus=N&Rank=N&Season={season}&SeasonSegment=&SeasonType=Regular+Season
  &ShotClockRange=&StarterBench=&TeamID={teamId}&TwoWay=0&VsConference=&VsDivision=
```

#### Live Game Data:
```
https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json
https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{gameId}.json
```

#### Schedule Data:
```
https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json
```

## Best Practices

### 1. **Error Handling**
- Always include detailed error responses
- Provide suggestions for common issues
- Include timestamps for debugging

### 2. **Parameter Validation**
- Validate required parameters early
- Provide helpful error messages with examples
- Include common team IDs in error responses

### 3. **Data Parsing**
- Handle missing data gracefully with null checks
- Use consistent data structure across workers
- Include metadata about data source and timestamp

### 4. **Caching Strategy**
- Use Cloudflare's built-in caching (5-minute TTL typical)
- Cache expensive operations
- Consider data freshness requirements

### 5. **API Headers**
- **NEVER** modify the NBA headers - they're finely tuned to avoid detection
- Include all browser simulation headers
- Use consistent User-Agent across workers

## Common Team IDs

```javascript
const COMMON_TEAM_IDS = {
  'Boston Celtics': '1610612738',
  'Los Angeles Lakers': '1610612747',
  'Golden State Warriors': '1610612744',
  'Philadelphia 76ers': '1610612755',
  'Miami Heat': '1610612748',
  'Chicago Bulls': '1610612741',
  'Milwaukee Bucks': '1610612749',
  'Oklahoma City Thunder': '1610612760',
  'San Antonio Spurs': '1610612759',
  'Charlotte Hornets': '1610612766'
};
```

## Deployment Notes

### Environment Setup
1. Deploy each worker to Cloudflare Workers
2. Use consistent subdomain naming: `nba-worker-{purpose}.scottcinatl.workers.dev`
3. Monitor usage and performance through Cloudflare dashboard

### Rate Limiting Considerations
- NBA APIs have strict rate limits
- Workers help distribute load across edge locations
- Monitor error rates for rate limit detection
- Consider implementing worker-level rate limiting for protection

### Debugging
- Use `/test` endpoints where available for health checks
- Monitor Cloudflare Workers logs for API issues
- Check NBA API status if workers fail simultaneously

## Usage in Applications

### Basic Fetch Pattern
```javascript
async function fetchNBAData(endpoint, params) {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('NBA API Error:', error);
    throw error;
  }
}

// Usage
const teamData = await fetchNBAData(
  'https://nba-worker-teams.scottcinatl.workers.dev/teams', 
  { id: '1610612738', season: '2025-26', lastN: '10' }
);
```

### Error Handling Pattern
```javascript
try {
  const data = await fetchNBAData(endpoint, params);
  // Process successful data
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 5000));
    return fetchNBAData(endpoint, params);
  } else {
    // Handle other errors
    console.error('Unrecoverable error:', error);
  }
}
```

## Security & Compliance

- Workers act as proxies to legitimate NBA APIs
- No data storage or caching beyond Cloudflare's edge cache
- Respect NBA's terms of service and rate limits
- For commercial use, ensure compliance with NBA data usage policies

---

**Last Updated**: October 31, 2025
**Maintained By**: NBA Analytics System
**Contact**: Technical documentation for development team use