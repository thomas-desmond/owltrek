import type { APIRoute } from 'astro';
import { getNextTwoWeeks, formatDateInTimezone } from '../../lib/dates';
import { analyzeNight, getMoonPhaseName } from '../../lib/analyzer';

// Location Configuration - San Diego, CA
const LOCATION = {
  lat: 32.7157,
  lon: -117.1611,
  timezone: 'America/Los_Angeles',
  name: 'San Diego, CA'
};

export const GET: APIRoute = async () => {
  // Get next 14 days in the target timezone
  const dates = getNextTwoWeeks(LOCATION.timezone);
  
  // Analyze each night
  const analyses = dates.map(date => 
    analyzeNight(date, LOCATION.lat, LOCATION.lon, LOCATION.timezone)
  );
  
  // Filter for good nights only
  const goodNights = analyses.filter(a => a.isGoodNight);
  
  // Log summary (for cron job monitoring)
  console.log('=== OwlTrek Weekly Forecast ===');
  console.log(`Location: ${LOCATION.name}`);
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Total days analyzed: ${analyses.length}`);
  console.log(`Good nights found: ${goodNights.length}`);
  console.log('');
  
  if (goodNights.length > 0) {
    console.log('🌟 Good Nights for Hiking/Stargazing:');
    goodNights.forEach(night => {
      const dateIdx = analyses.indexOf(night);
      const formattedDate = formatDateInTimezone(dates[dateIdx], LOCATION.timezone);
      console.log(`  - ${formattedDate}: ${getMoonPhaseName(night.moonPhase)} (${night.illumination}% illumination)`);
      night.reasons.forEach(reason => {
        console.log(`      ${reason}`);
      });
    });
  } else {
    console.log('No ideal nights in the next 14 days.');
    console.log('Consider nights with lower illumination for stargazing.');
  }
  
  console.log('================================');
  
  // Return JSON response
  return new Response(
    JSON.stringify({
      success: true,
      location: LOCATION,
      generatedAt: new Date().toISOString(),
      totalDays: analyses.length,
      goodNightsCount: goodNights.length,
      goodNights: goodNights.map((night, idx) => {
        const originalIdx = analyses.indexOf(night);
        return {
          date: night.dateString,
          displayDate: formatDateInTimezone(dates[originalIdx], LOCATION.timezone),
          moonPhase: getMoonPhaseName(night.moonPhase),
          illumination: night.illumination,
          weather: night.weather,
          reasons: night.reasons
        };
      }),
      allNights: analyses.map((night, idx) => ({
        date: night.dateString,
        displayDate: formatDateInTimezone(dates[idx], LOCATION.timezone),
        moonPhase: getMoonPhaseName(night.moonPhase),
        illumination: night.illumination,
        isGoodNight: night.isGoodNight
      }))
    }, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};
