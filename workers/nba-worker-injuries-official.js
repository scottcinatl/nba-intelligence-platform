/**
 * NBA Official Injury Report Worker
 * 
 * Fetches the official NBA injury report PDF that contains all teams
 * URL: https://ak-static.cms.nba.com/referee/injury/Injury-Report_YYYY-MM-DD_03PM.pdf
 * 
 * Deploy to: nba-worker-injuries-official.scottcinatl.workers.dev
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getTodayDate();
    
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Construct the official NBA injury report URL
      const injuryReportUrl = `https://ak-static.cms.nba.com/referee/injury/Injury-Report_${date}_03PM.pdf`;
      
      console.log(`Fetching official injury report: ${injuryReportUrl}`);
      
      // Check if PDF exists
      const pdfResponse = await fetch(injuryReportUrl, { method: 'HEAD' });
      
      if (!pdfResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Official injury report not available for ${date}`,
            attempted_url: injuryReportUrl,
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

      // PDF exists, return URL and metadata
      return new Response(
        JSON.stringify({
          success: true,
          date,
          pdfUrl: injuryReportUrl,
          source: 'NBA_OFFICIAL',
          lastUpdated: new Date().toISOString(),
          note: 'Official NBA injury report containing all teams'
        }),
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
          error: `Error fetching official injury report: ${error.message}`,
          date
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
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}