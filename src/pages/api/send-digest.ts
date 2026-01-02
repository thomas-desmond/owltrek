import type { APIRoute } from 'astro';
import { getNextTwoWeeks, formatDateInTimezone } from '../../lib/dates';
import { analyzeNight, getMoonPhaseName } from '../../lib/analyzer';

const LOCATION = {
  lat: 33.159586,
  lon: -117.067950,
  timezone: 'America/Los_Angeles',
  name: 'Escondido, CA'
};

// Recipients for daily digest
const RECIPIENTS = [
  'tdesmond@cloudflare.com',
  'thomasdes533@gmail.com'
];

function generateEmailHtml(goodNights: any[], location: typeof LOCATION): string {
  const nightsHtml = goodNights.length > 0
    ? goodNights.map(night => `
        <div style="margin-bottom: 16px; padding: 12px; background: #1e1b4b; border-radius: 8px; border-left: 4px solid ${night.type === 'hiking' ? '#f59e0b' : '#6366f1'};">
          <p style="margin: 0; font-weight: bold; color: white;">${night.displayDate}</p>
          <p style="margin: 4px 0 0; color: ${night.type === 'hiking' ? '#fbbf24' : '#a5b4fc'};">
            ${night.type === 'hiking' ? '🌕' : '✨'} ${night.reason}
          </p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 14px;">
            ${night.moonPhase} • ${night.illumination}% illumination
          </p>
        </div>
      `).join('')
    : '<p style="color: #9ca3af;">No ideal nights in the next two weeks. Check back later!</p>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0a1d; color: white; padding: 24px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h1 style="margin: 0 0 8px;">🦉 OwlTrek Weekly Forecast</h1>
        <p style="margin: 0 0 24px; color: #9ca3af;">📍 ${location.name}</p>
        
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #e5e7eb;">
          ${goodNights.length > 0 ? 'Good nights to go outside:' : 'This week\'s outlook'}
        </h2>
        
        ${nightsHtml}
        
        <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          Sent by OwlTrek • Moon data via SunCalc
        </p>
      </div>
    </body>
    </html>
  `;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Secret',
};

// OPTIONS handler for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

// GET handler for simple health check / debugging
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ status: 'ok', message: 'Use POST to send digest emails' }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  // Get secrets from Cloudflare environment
  const env = locals.runtime.env;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const CRON_SECRET = env.CRON_SECRET;

  // Check for cron secret (skip check if from localhost for testing)
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const cronSecret = request.headers.get('X-Cron-Secret');
  
  if (!isLocalhost && cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Generate the forecast data
  const dates = getNextTwoWeeks(LOCATION.timezone);
  const analyses = dates.map(date => 
    analyzeNight(date, LOCATION.lat, LOCATION.lon, LOCATION.timezone)
  );
  
  const goodNights = analyses
    .map((night, idx) => ({ ...night, idx }))
    .filter(n => n.isGoodNight)
    .map(night => ({
      date: night.dateString,
      displayDate: formatDateInTimezone(dates[night.idx], LOCATION.timezone),
      moonPhase: getMoonPhaseName(night.moonPhase),
      illumination: night.illumination,
      reason: night.reason,
      type: night.goodNightType
    }));

  // Send email via Resend
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OwlTrek <noreply@mail.owltrek.com>',
        to: RECIPIENTS,
        subject: `🦉 OwlTrek: ${goodNights.length} good night${goodNights.length !== 1 ? 's' : ''} this week`,
        html: generateEmailHtml(goodNights, LOCATION),
      }),
    });

    const data = await response.json() as { id?: string; message?: string };

    if (!response.ok) {
      console.error('Resend API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailId: data.id ?? null, goodNightsCount: goodNights.length }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Email send error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
