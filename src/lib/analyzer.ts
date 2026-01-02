import SunCalc from 'suncalc';
import { format } from 'date-fns-tz';

export interface NightAnalysis {
  dateString: string;
  illumination: number;
  moonPhase: number;
  moonRise: Date | null;
  moonSet: Date | null;
  sunset: Date | null;
  weather: string;
  isGoodNight: boolean;
  goodNightType: 'stargazing' | 'hiking' | null;
  reason: string | null;
}

/**
 * Analyzes a night for hiking/stargazing conditions.
 * 
 * Good Night Criteria:
 * 1. Full Moon (>90% illumination) - Great for night hiking with natural light
 * 2. New Moon (<10% illumination) - Dark skies for stargazing
 * 3. Moon sets near sunset - No moon during the night = dark skies
 * 
 * The moonset-near-sunset check catches nights where the moon won't be
 * visible during typical evening hours, even if illumination is moderate.
 */
export function analyzeNight(
  date: Date,
  lat: number,
  lon: number,
  timezone: string
): NightAnalysis {
  // Get moon illumination for this date
  const moonIllum = SunCalc.getMoonIllumination(date);
  const illuminationPercent = moonIllum.fraction * 100;
  
  // Get moon times for this location and date
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  
  // Get sun times for sunset
  const sunTimes = SunCalc.getTimes(date, lat, lon);
  const sunset = sunTimes.sunset;
  
  // Check conditions
  const isNewMoon = illuminationPercent < 10;
  const isFullMoon = illuminationPercent > 90;
  
  // Check if moon sets within 2 hours of sunset (moon won't be up during the night)
  const moonSetsNearSunset = checkMoonSetsNearSunset(moonTimes.set, sunset);
  
  // Mock weather for now - will integrate real weather API later
  const weather = 'Clear';
  const isClearWeather = true;
  
  // Determine good night type and reason
  let goodNightType: 'stargazing' | 'hiking' | null = null;
  let reason: string | null = null;
  
  if (isClearWeather) {
    if (isFullMoon) {
      goodNightType = 'hiking';
      reason = 'Full moon for night hiking';
    } else if (isNewMoon) {
      goodNightType = 'stargazing';
      reason = 'New moon for stargazing';
    } else if (moonSetsNearSunset) {
      goodNightType = 'stargazing';
      reason = 'Moon sets early — dark skies';
    }
  }
  
  const isGoodNight = goodNightType !== null;
  const dateString = format(date, 'yyyy-MM-dd', { timeZone: timezone });
  
  return {
    dateString,
    illumination: Math.round(illuminationPercent),
    moonPhase: moonIllum.phase,
    moonRise: moonTimes.rise || null,
    moonSet: moonTimes.set || null,
    sunset,
    weather,
    isGoodNight,
    goodNightType,
    reason,
  };
}

/**
 * Check if moon sets within ~2 hours of sunset.
 * This means the moon won't be visible during the night.
 */
function checkMoonSetsNearSunset(moonSet: Date | undefined, sunset: Date): boolean {
  if (!moonSet || !sunset) return false;
  
  const diffMs = moonSet.getTime() - sunset.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Moon sets between 2 hours before and 2 hours after sunset
  return diffHours >= -2 && diffHours <= 2;
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
