import type { APIRoute } from 'astro';
import { getNextDays, formatDateInTimezone } from '../../lib/dates';
import { analyzeNight, getMoonPhaseName } from '../../lib/analyzer';

interface Subscriber {
  email: string;
  location_lat: number;
  location_lon: number;
  location_name: string;
  timezone: string;
  frequency: string;
  last_email_sent: string | null;
}

interface LocationConfig {
  lat: number;
  lon: number;
  timezone: string;
  name: string;
}

function generateEmailHtml(goodNights: any[], location: LocationConfig, unsubscribeUrl: string): string {
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
          Sent by OwlTrek • Moon data via SunCalc<br>
          <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a>
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
  // Get secrets and DB from Cloudflare environment
  const env = locals.runtime.env;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const CRON_SECRET = env.CRON_SECRET;
  const db = env.OWLTREK_DB;

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

  try {
    // Get all confirmed, subscribed users
    const { results: subscribers } = await db.prepare(
      'SELECT email, location_lat, location_lon, location_name, timezone, frequency, last_email_sent FROM subscribers WHERE confirmed = 1 AND subscribed = 1'
    ).all<Subscriber>();

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscribers to send to', emailsSent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let emailsSent = 0;
    const errors: string[] = [];

    const now = new Date();
    const nowISO = now.toISOString();

    // Send personalized email to each subscriber (respecting frequency)
    for (const subscriber of subscribers) {
      // Check if we should skip based on frequency
      if (subscriber.last_email_sent) {
        const lastSent = new Date(subscriber.last_email_sent);
        const hoursSinceLastEmail = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        
        if (subscriber.frequency === 'daily' && hoursSinceLastEmail < 20) {
          continue; // Skip if sent within last 20 hours
        }
        if (subscriber.frequency === 'weekly' && hoursSinceLastEmail < 144) {
          continue; // Skip if sent within last 6 days (144 hours)
        }
      }
      const location: LocationConfig = {
        lat: subscriber.location_lat,
        lon: subscriber.location_lon,
        timezone: subscriber.timezone,
        name: subscriber.location_name,
      };

      // Generate forecast for this subscriber's location
      const dates = getNextDays(location.timezone, 14);
      const analyses = dates.map(date => 
        analyzeNight(date, location.lat, location.lon, location.timezone)
      );
      
      const goodNights = analyses
        .map((night, idx) => ({ ...night, idx }))
        .filter(n => n.isGoodNight)
        .map(night => ({
          date: night.dateString,
          displayDate: formatDateInTimezone(dates[night.idx], location.timezone),
          moonPhase: getMoonPhaseName(night.moonPhase),
          illumination: night.illumination,
          reason: night.reason,
          type: night.goodNightType
        }));

      const unsubscribeUrl = `https://owltrek.com/api/subscribers/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'OwlTrek <noreply@mail.owltrek.com>',
            to: [subscriber.email],
            subject: `🦉 OwlTrek: ${goodNights.length} good night${goodNights.length !== 1 ? 's' : ''} coming up`,
            html: generateEmailHtml(goodNights, location, unsubscribeUrl),
          }),
        });

        if (response.ok) {
          emailsSent++;
          // Update last_email_sent timestamp
          await db.prepare(
            'UPDATE subscribers SET last_email_sent = ? WHERE email = ?'
          ).bind(nowISO, subscriber.email).run();
        } else {
          const errorData = await response.json() as { message?: string };
          errors.push(`${subscriber.email}: ${errorData.message || 'Unknown error'}`);
        }
      } catch (emailError) {
        errors.push(`${subscriber.email}: ${String(emailError)}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        totalSubscribers: subscribers.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Send digest error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
