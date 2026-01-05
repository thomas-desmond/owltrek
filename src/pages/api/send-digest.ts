import type { APIRoute } from 'astro';
import { getNextWeek, formatDateInTimezone } from '../../lib/dates';
import { analyzeNight, getMoonPhaseName } from '../../lib/analyzer';
import { getWeatherForecast } from '../../lib/weather';

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

interface NextOutdoorDay {
  displayDate: string;
  daysFromNow: number;
  reason: string;
  type: 'hiking' | 'stargazing';
  moonPhase: string;
  illumination: number;
  weather: string;
}

function generateHeroHtml(nextOutdoorDay: NextOutdoorDay | null): string {
  if (!nextOutdoorDay) {
    return `
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: 12px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #9ca3af;">Next Outdoor Night</p>
        <p style="margin: 8px 0 0; font-size: 18px; color: #e5e7eb;">No ideal nights this week</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Check back for updated forecasts</p>
      </div>
    `;
  }

  const isHiking = nextOutdoorDay.type === 'hiking';
  const emoji = isHiking ? '🌕' : '✨';
  const gradientColors = isHiking 
    ? 'linear-gradient(135deg, #78350f 0%, #b45309 100%)' 
    : 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)';
  const accentColor = isHiking ? '#fbbf24' : '#a5b4fc';
  
  const daysText = nextOutdoorDay.daysFromNow === 0 
    ? 'Tonight!' 
    : nextOutdoorDay.daysFromNow === 1 
      ? 'Tomorrow' 
      : `In ${nextOutdoorDay.daysFromNow} days`;

  return `
    <div style="margin-bottom: 24px; padding: 20px; background: ${gradientColors}; border-radius: 12px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.7);">Next Outdoor Night</p>
      <p style="margin: 8px 0 0; font-size: 32px;">${emoji}</p>
      <p style="margin: 8px 0 0; font-size: 24px; font-weight: bold; color: white;">${nextOutdoorDay.displayDate}</p>
      <p style="margin: 4px 0 0; font-size: 16px; color: ${accentColor};">${daysText}</p>
      <p style="margin: 12px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">${nextOutdoorDay.reason}</p>
      <p style="margin: 8px 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">
        ${nextOutdoorDay.moonPhase} • ${nextOutdoorDay.illumination}% moon • ${nextOutdoorDay.weather}
      </p>
      <a href="https://owltrek.com" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: rgba(255,255,255,0.2); color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">View Full Forecast →</a>
    </div>
  `;
}

function generateEmailHtml(goodNights: any[], nextOutdoorDay: NextOutdoorDay | null, location: LocationConfig, unsubscribeUrl: string): string {
  const heroHtml = generateHeroHtml(nextOutdoorDay);
  
  const nightsHtml = goodNights.length > 0
    ? goodNights.map(night => `
        <div style="margin-bottom: 16px; padding: 12px; background: #1e1b4b; border-radius: 8px; border-left: 4px solid ${night.type === 'hiking' ? '#f59e0b' : '#6366f1'};">
          <p style="margin: 0; font-weight: bold; color: white;">${night.displayDate}</p>
          <p style="margin: 4px 0 0; color: ${night.type === 'hiking' ? '#fbbf24' : '#a5b4fc'};">
            ${night.type === 'hiking' ? '🌕' : '✨'} ${night.reason}
          </p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 14px;">
            ${night.moonPhase} • ${night.illumination}% illumination • ${night.weather}
          </p>
        </div>
      `).join('')
    : '<p style="color: #9ca3af;">No ideal nights in the next 7 days. Check back later!</p>';

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
        
        ${heroHtml}
        
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #e5e7eb;">
          ${goodNights.length > 0 ? 'All good nights this week:' : 'This week\'s outlook'}
        </h2>
        
        ${nightsHtml}
        
        <div style="margin-top: 24px; padding: 16px; background: #1e1b4b; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 12px; color: #e5e7eb; font-size: 14px;">Want more details? Check the moon calendar and hourly forecasts.</p>
          <a href="https://owltrek.com" style="display: inline-block; padding: 12px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Visit OwlTrek.com</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          Sent by <a href="https://owltrek.com" style="color: #6b7280;">OwlTrek</a> • Moon data via SunCalc<br>
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

      // Generate forecast for this subscriber's location (7 days to match weather accuracy)
      const dates = getNextWeek(location.timezone);
      
      // Fetch weather data for accurate forecasting
      let weatherData = new Map();
      try {
        weatherData = await getWeatherForecast(location.lat, location.lon);
      } catch (e) {
        console.error(`Weather fetch failed for ${subscriber.email}:`, e);
      }
      
      const analyses = dates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const weather = weatherData.get(dateStr);
        return analyzeNight(date, location.lat, location.lon, location.timezone, weather);
      });
      
      const goodNights = analyses
        .map((night, idx) => ({ ...night, idx }))
        .filter(n => n.isGoodNight)
        .map(night => ({
          date: night.dateString,
          displayDate: formatDateInTimezone(dates[night.idx], location.timezone),
          moonPhase: getMoonPhaseName(night.moonPhase),
          illumination: night.illumination,
          reason: night.reason,
          type: night.goodNightType,
          weather: night.weather || 'Weather unavailable'
        }));

      // Find next outdoor day for hero section
      const nextOutdoorDay: NextOutdoorDay | null = goodNights.length > 0 ? {
        displayDate: goodNights[0].displayDate,
        daysFromNow: analyses.findIndex(a => a.isGoodNight),
        reason: goodNights[0].reason || 'Good conditions for outdoor activities',
        type: goodNights[0].type as 'hiking' | 'stargazing',
        moonPhase: goodNights[0].moonPhase,
        illumination: goodNights[0].illumination,
        weather: goodNights[0].weather
      } : null;

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
            html: generateEmailHtml(goodNights, nextOutdoorDay, location, unsubscribeUrl),
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
