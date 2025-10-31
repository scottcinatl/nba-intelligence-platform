/**
 * NBA Game Notes Worker - Simplified version for Cloudflare Workers
 * Endpoint: /gamenotes?team=TEAMABBR (e.g., PHI, BOS, LAL)
 * 
 * Note: This version fetches PDFs but returns URL for client-side parsing
 * For full PDF parsing, you'll need to implement client-side parsing or use a service
 */

// Team abbreviation to PDF slug mapping
const PDF_SLUGS = {
  'ATL': 'hawks',
  'BOS': 'celtics', 
  'BKN': 'nets',
  'CHA': 'hornets',
  'CHI': 'bulls',
  'CLE': 'cavaliers',
  'DAL': 'mavericks',
  'DEN': 'nuggets',
  'DET': 'pistons',
  'GSW': 'warriors',
  'HOU': 'rockets',
  'IND': 'pacers',
  'LAC': 'clippers',
  'LAL': 'lakers',
  'MEM': 'grizzlies',
  'MIA': 'heat',
  'MIL': 'bucks',
  'MIN': 'timberwolves',
  'NOP': 'pelicans',
  'NYK': 'knicks',
  'OKC': 'thunder',
  'ORL': 'magic',
  'PHI': 'sixers',
  'PHX': 'suns',
  'POR': 'blazers',
  'SAC': 'kings',
  'SAS': 'spurs',
  'TOR': 'raptors',
  'UTA': 'jazz',
  'WAS': 'wizards'
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const team = url.searchParams.get('team');

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!team) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Team parameter required. Use ?team=PHI format.' 
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    const teamUpper = team.toUpperCase();
    const pdfSlug = PDF_SLUGS[teamUpper];

    if (!pdfSlug) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid team: ${team}. Use standard NBA abbreviations (PHI, BOS, etc.)` 
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    try {
      // Check if PDF exists and is accessible
      const pdfUrl = `https://www.nba.com/gamenotes/${pdfSlug}.pdf`;
      const pdfResponse = await fetch(pdfUrl, { method: 'HEAD' });
      
      if (!pdfResponse.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `PDF not available for ${team}. May not have a game today.`,
            pdfUrl,
            status: pdfResponse.status
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }

      // Return PDF info and mock data structure for now
      // In Phase 2, we'll implement actual PDF parsing
      const gameNotesData = {
        success: true,
        team: teamUpper,
        lastUpdated: new Date().toISOString(),
        pdfUrl,
        pdfAvailable: true,
        
        // Mock data structure - replace with actual parsing in Phase 2
        injuries: getMockInjuries(teamUpper),
        h2hHistory: [],
        startingLineup: [],
        teamTrends: [],
        recentGames: [],
        seasonStats: {},
        
        // For now, provide PDF URL so client can handle parsing
        note: "PDF parsing will be implemented in Phase 2. Use pdfUrl for manual parsing."
      };

      return new Response(
        JSON.stringify(gameNotesData),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error checking game notes: ${error.message}` 
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
  }
};

/**
 * Mock injury data for testing - replace with PDF parsing
 */
function getMockInjuries(team) {
  const mockData = {
    'PHI': [
      {
        name: 'Joel Embiid',
        injury: 'Left Knee; Management',
        status: 'questionable',
        dates: '10/28/25',
        gamesMissed: 1
      }
    ],
    'BOS': [
      {
        name: 'Jayson Tatum',
        injury: 'Right Achilles; Repair', 
        status: 'out',
        dates: '10/22 through 10/27/25',
        gamesMissed: 4
      }
    ],
    'LAL': [
      {
        name: 'Anthony Davis',
        injury: 'Left Foot; Plantar Fasciitis',
        status: 'probable',
        dates: '10/29/25',
        gamesMissed: 0
      }
    ]
  };
  
  return mockData[team] || [];
}