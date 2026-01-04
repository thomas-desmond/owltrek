/**
 * Weather data fetching from Open-Meteo API
 * https://open-meteo.com/en/docs
 * 
 * Limited to 7 days since forecast accuracy degrades significantly beyond that.
 */

export interface HourlyWeather {
  cloudCover: number;        // 0-100%
  temperature: number;       // °C
  windSpeed: number;         // km/h
  precipitationProb: number; // 0-100%
  visibility: number;        // meters
  humidity: number;          // 0-100%
}

export interface NightWeather {
  cloudCover: number;        // Average cloud cover during night hours (0-100%)
  temperature: number;       // Average temp during night hours (°C)
  windSpeed: number;         // Average wind speed (km/h)
  precipitationProb: number; // Max precipitation probability (0-100%)
  visibility: number;        // Average visibility (meters)
  humidity: number;          // Average humidity (0-100%)
  isClear: boolean;          // Cloud cover < 30%
  isGoodWeather: boolean;    // Clear + low precip + reasonable wind
}

const WEATHER_FORECAST_DAYS = 7;

/**
 * Fetches weather forecast and returns night-averaged data keyed by date string.
 * Only returns data for the next 7 days (weather beyond that is unreliable).
 */
export async function getWeatherForecast(
  lat: number,
  lon: number
): Promise<Map<string, NightWeather>> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('hourly', [
    'cloud_cover',
    'temperature_2m',
    'wind_speed_10m',
    'precipitation_probability',
    'visibility',
    'relative_humidity_2m'
  ].join(','));
  url.searchParams.set('forecast_days', WEATHER_FORECAST_DAYS.toString());
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json() as OpenMeteoResponse;
  return processHourlyData(data);
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    cloud_cover: number[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    precipitation_probability: number[];
    visibility: number[];
    relative_humidity_2m: number[];
  };
}

/**
 * Process hourly data into nightly averages.
 * "Night" is defined as 8 PM to 2 AM (typical stargazing/hiking hours).
 */
function processHourlyData(data: OpenMeteoResponse): Map<string, NightWeather> {
  const result = new Map<string, NightWeather>();
  const { hourly } = data;

  // Group hours by date and filter to night hours (20:00-02:00)
  const nightHoursByDate = new Map<string, number[]>();

  for (let i = 0; i < hourly.time.length; i++) {
    const dateTime = new Date(hourly.time[i]);
    const hour = dateTime.getHours();
    
    // Night hours: 8 PM (20) to 2 AM (02)
    // For 20-23, use that day's date
    // For 00-02, use previous day's date (it's the same "night")
    if (hour >= 20 || hour <= 2) {
      let nightDate: string;
      if (hour >= 20) {
        nightDate = hourly.time[i].split('T')[0];
      } else {
        // Early morning hours belong to previous night
        const prevDay = new Date(dateTime);
        prevDay.setDate(prevDay.getDate() - 1);
        nightDate = prevDay.toISOString().split('T')[0];
      }

      if (!nightHoursByDate.has(nightDate)) {
        nightHoursByDate.set(nightDate, []);
      }
      nightHoursByDate.get(nightDate)!.push(i);
    }
  }

  // Calculate averages for each night
  for (const [dateStr, indices] of nightHoursByDate) {
    if (indices.length === 0) continue;

    const cloudCovers = indices.map(i => hourly.cloud_cover[i]);
    const temps = indices.map(i => hourly.temperature_2m[i]);
    const winds = indices.map(i => hourly.wind_speed_10m[i]);
    const precips = indices.map(i => hourly.precipitation_probability[i]);
    const visibilities = indices.map(i => hourly.visibility[i]);
    const humidities = indices.map(i => hourly.relative_humidity_2m[i]);

    const avgCloudCover = average(cloudCovers);
    const avgWindSpeed = average(winds);
    const maxPrecipProb = Math.max(...precips);

    const isClear = avgCloudCover < 30;
    const isGoodWeather = isClear && maxPrecipProb < 20 && avgWindSpeed < 25;

    result.set(dateStr, {
      cloudCover: Math.round(avgCloudCover),
      temperature: Math.round(average(temps)),
      windSpeed: Math.round(avgWindSpeed),
      precipitationProb: Math.round(maxPrecipProb),
      visibility: Math.round(average(visibilities)),
      humidity: Math.round(average(humidities)),
      isClear,
      isGoodWeather,
    });
  }

  return result;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
