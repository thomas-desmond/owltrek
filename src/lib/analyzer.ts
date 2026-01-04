import SunCalc from 'suncalc';
import { format } from 'date-fns-tz';
import type { NightWeather } from './weather';

export interface NightAnalysis {
  dateString: string;
  illumination: number;
  moonPhase: number;
  moonRise: Date | null;
  moonSet: Date | null;
  sunset: Date | null;
  weather: string;
  cloudCover: number | null;
  temperature: number | null;
  windSpeed: number | null;
  hasWeatherData: boolean;
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
 * 3. Moon-free evening window - Moon is below horizon from sunset to midnight
 *    (e.g., moon set in morning, doesn't rise until after midnight)
 */
export function analyzeNight(
  date: Date,
  lat: number,
  lon: number,
  timezone: string,
  weatherData?: NightWeather
): NightAnalysis {
  // Get moon illumination for this date
  const moonIllum = SunCalc.getMoonIllumination(date);
  const illuminationPercent = moonIllum.fraction * 100;
  
  // Get moon times for this location and date
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  
  // Get sun times for sunset
  const sunTimes = SunCalc.getTimes(date, lat, lon);
  const sunset = sunTimes.sunset;
  
  // Also get moon times for the next day (moon rise might be after midnight)
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayMoonTimes = SunCalc.getMoonTimes(nextDay, lat, lon);
  
  // Check conditions
  const isNewMoon = illuminationPercent < 10;
  const isFullMoon = illuminationPercent > 90;
  
  // Check if there's a moon-free window in the evening (sunset to midnight)
  const moonFreeEvening = checkMoonFreeEvening(
    sunset,
    moonTimes.set,
    moonTimes.rise,
    nextDayMoonTimes.rise
  );
  
  // Use real weather data if available, otherwise assume clear (for days 8-14)
  const hasWeatherData = !!weatherData;
  const isClearWeather = weatherData ? weatherData.isGoodWeather : true;
  const weather = getWeatherDescription(weatherData);
  
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
    } else if (moonFreeEvening.isMoonFree) {
      goodNightType = 'stargazing';
      reason = moonFreeEvening.reason;
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
    cloudCover: weatherData?.cloudCover ?? null,
    temperature: weatherData?.temperature ?? null,
    windSpeed: weatherData?.windSpeed ?? null,
    hasWeatherData,
    isGoodNight,
    goodNightType,
    reason,
  };
}

/**
 * Check if the moon is below the horizon during evening hours (sunset to midnight).
 * This catches scenarios like:
 * - Moon set in the morning, doesn't rise until after midnight
 * - Moon sets shortly after sunset
 */
function checkMoonFreeEvening(
  sunset: Date | undefined,
  moonSet: Date | undefined,
  moonRise: Date | undefined,
  nextDayMoonRise: Date | undefined
): { isMoonFree: boolean; reason: string } {
  if (!sunset) return { isMoonFree: false, reason: '' };
  
  // Define "evening" as sunset to midnight
  const midnight = new Date(sunset);
  midnight.setHours(24, 0, 0, 0);
  
  // Scenario 1: Moon set before sunset (was up during day, down all evening)
  // and doesn't rise until after midnight
  if (moonSet && moonSet < sunset) {
    // Check when moon rises - either later today or tomorrow
    const effectiveMoonRise = moonRise && moonRise > sunset ? moonRise : nextDayMoonRise;
    
    if (!effectiveMoonRise || effectiveMoonRise > midnight) {
      return { isMoonFree: true, reason: 'Moon down all evening — dark skies' };
    }
  }
  
  // Scenario 2: Moon sets within 1 hour after sunset (brief moon, then dark)
  if (moonSet && moonSet > sunset) {
    const hoursAfterSunset = (moonSet.getTime() - sunset.getTime()) / (1000 * 60 * 60);
    if (hoursAfterSunset <= 1) {
      return { isMoonFree: true, reason: 'Moon sets early — dark skies' };
    }
  }
  
  // Scenario 3: Moon doesn't rise until late (after 10 PM)
  // This gives at least 4-5 hours of dark sky after sunset
  const effectiveMoonRise = moonRise && moonRise > sunset ? moonRise : nextDayMoonRise;
  if (effectiveMoonRise) {
    const moonRiseHour = effectiveMoonRise.getHours();
    const hoursAfterSunset = (effectiveMoonRise.getTime() - sunset.getTime()) / (1000 * 60 * 60);
    
    // Moon rises at least 4 hours after sunset
    if (hoursAfterSunset >= 4) {
      return { isMoonFree: true, reason: 'Late moonrise — dark evening' };
    }
  }
  
  return { isMoonFree: false, reason: '' };
}

/**
 * Get a human-readable weather description
 */
function getWeatherDescription(weather?: NightWeather): string {
  if (!weather) return 'Too far out';
  
  if (weather.cloudCover < 20) return 'Clear';
  if (weather.cloudCover < 50) return 'Partly Cloudy';
  if (weather.cloudCover < 80) return 'Mostly Cloudy';
  return 'Overcast';
}

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
