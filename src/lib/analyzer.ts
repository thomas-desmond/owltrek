import SunCalc from 'suncalc';
import { format } from 'date-fns-tz';

export interface NightAnalysis {
  dateString: string;
  illumination: number;
  moonPhase: number;
  moonRise: Date | null;
  moonSet: Date | null;
  weather: string;
  isGoodNight: boolean;
  reasons: string[];
}

/**
 * Analyzes a night for hiking/stargazing conditions.
 * 
 * @param date - A Date object representing the LOCAL calendar date to analyze.
 *               This should be midnight in the local timezone (from getNextTwoWeeks).
 * @param lat - Latitude of the location
 * @param lon - Longitude of the location  
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns NightAnalysis with moon data and recommendations
 * 
 * Timezone Safety:
 * - The `date` parameter represents a local calendar date
 * - SunCalc.getMoonIllumination uses UTC internally but we pass the local midnight
 * - MoonRise/MoonSet times are returned as UTC Date objects
 * - The caller is responsible for formatting these times in the target timezone
 */
export function analyzeNight(
  date: Date,
  lat: number,
  lon: number,
  timezone: string
): NightAnalysis {
  // Get moon illumination for this date
  // SunCalc works with the Date's UTC value, so we pass our local-midnight date
  const moonIllum = SunCalc.getMoonIllumination(date);
  const illuminationPercent = moonIllum.fraction * 100;
  
  // Get moon times for this location and date
  // Returns times in UTC as Date objects
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  
  // Determine if it's a "good night"
  // Good = New Moon (<10% illumination) OR Full Moon (>90% illumination)
  // New Moon = dark skies for stargazing
  // Full Moon = bright enough for night hiking without flashlights
  const isNewMoon = illuminationPercent < 10;
  const isFullMoon = illuminationPercent > 90;
  
  // Mock weather for now (always clear)
  const weather = 'Clear';
  const isClearWeather = weather === 'Clear';
  
  // Build reasons array
  const reasons: string[] = [];
  
  if (isNewMoon) {
    reasons.push('🌑 New Moon - Excellent for stargazing');
  } else if (isFullMoon) {
    reasons.push('🌕 Full Moon - Great for night hiking');
  }
  
  if (isClearWeather) {
    reasons.push('☀️ Clear skies expected');
  }
  
  // A night is "good" if we have favorable moon AND clear weather
  const isGoodNight = (isNewMoon || isFullMoon) && isClearWeather;
  
  // Format the date string for display (local timezone)
  const dateString = format(date, 'yyyy-MM-dd', { timeZone: timezone });
  
  return {
    dateString,
    illumination: Math.round(illuminationPercent),
    moonPhase: moonIllum.phase,
    moonRise: moonTimes.rise || null,
    moonSet: moonTimes.set || null,
    weather,
    isGoodNight,
    reasons,
  };
}

/**
 * Get a human-readable moon phase name
 */
export function getMoonPhaseName(phase: number): string {
  // Phase is 0-1 where:
  // 0 = New Moon
  // 0.25 = First Quarter
  // 0.5 = Full Moon
  // 0.75 = Last Quarter
  if (phase < 0.0625) return 'New Moon';
  if (phase < 0.1875) return 'Waxing Crescent';
  if (phase < 0.3125) return 'First Quarter';
  if (phase < 0.4375) return 'Waxing Gibbous';
  if (phase < 0.5625) return 'Full Moon';
  if (phase < 0.6875) return 'Waning Gibbous';
  if (phase < 0.8125) return 'Last Quarter';
  if (phase < 0.9375) return 'Waning Crescent';
  return 'New Moon';
}
