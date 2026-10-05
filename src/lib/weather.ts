export type WeatherLocation = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type HourlyPoint = {
  time: string;
  temperature: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  humidity: number | null;
  weatherCode: number | null;
};

export type DailyPoint = {
  date: string;
  high: number | null;
  low: number | null;
  mean: number | null;
  precipitation: number | null;
  outlook: boolean;
};

export type WeatherData = {
  timezone: string;
  outlookError?: string;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Weather provider returned an invalid response.");
  }
  return value as JsonRecord;
}

function numberArray(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "number" ? item : null));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function fetchJson(url: URL): Promise<JsonRecord> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}. Please try again.`);
  }
  return asRecord(await response.json());
}

export async function fetchWeather(location: WeatherLocation): Promise<WeatherData> {
  const coordinates = {
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    timezone: "auto",
  };

  const googleUrl = new URL("https://ensemble-api.open-meteo.com/v1/ensemble");
  Object.entries({
    ...coordinates,
    hourly: "temperature_2m,precipitation,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    models: "google_weathernext2_ensemble",
    forecast_days: "16",
    temperature_unit: "celsius",
  }).forEach(([key, value]) => googleUrl.searchParams.set(key, value));

  const currentUrl = new URL("https://api.open-meteo.com/v1/forecast");
  Object.entries({
    ...coordinates,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    hourly: "relative_humidity_2m,precipitation_probability",
    forecast_days: "16",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  }).forEach(([key, value]) => currentUrl.searchParams.set(key, value));

  const seasonalUrl = new URL("https://seasonal-api.open-meteo.com/v1/seasonal");
  Object.entries({
    ...coordinates,
    daily: "temperature_2m_mean,precipitation_sum",
    forecast_days: "30",
  }).forEach(([key, value]) => seasonalUrl.searchParams.set(key, value));

  const [google, local] = await Promise.all([
    fetchJson(googleUrl),
    fetchJson(currentUrl),
  ]);
  const seasonalResult = await Promise.allSettled([fetchJson(seasonalUrl)]);
  const seasonal =
    seasonalResult[0].status === "fulfilled" ? seasonalResult[0].value : null;
  const outlookError =
    seasonalResult[0].status === "rejected"
      ? seasonalResult[0].reason instanceof Error
        ? seasonalResult[0].reason.message
        : "The seasonal outlook is temporarily unavailable."
      : undefined;
  const googleHourly = asRecord(google.hourly);
  const localHourly = asRecord(local.hourly);
  const current = asRecord(local.current);
  const googleDaily = asRecord(google.daily);
  const seasonalDaily = seasonal ? asRecord(seasonal.daily) : null;

  const googleTimes = stringArray(googleHourly.time);
  const humidity = numberArray(localHourly.relative_humidity_2m);
  const probabilities = numberArray(localHourly.precipitation_probability);
  const temperatures = numberArray(googleHourly.temperature_2m);
  const precipitation = numberArray(googleHourly.precipitation);
  const weatherCodes = numberArray(googleHourly.weather_code);

  const localTimes = stringArray(localHourly.time);
  const localHourIndex = new Map(localTimes.map((time, index) => [time, index]));
  const hourly: HourlyPoint[] = googleTimes.map((time, index) => {
    const localIndex = localHourIndex.get(time);
    return {
      time,
      temperature: temperatures[index] ?? null,
      precipitation: precipitation[index] ?? null,
      precipitationProbability:
        localIndex === undefined ? null : (probabilities[localIndex] ?? null),
      humidity: localIndex === undefined ? null : (humidity[localIndex] ?? null),
      weatherCode: weatherCodes[index] ?? null,
    };
  });

  const googleDailyDates = stringArray(googleDaily.time);
  const googleHighs = numberArray(googleDaily.temperature_2m_max);
  const googleLows = numberArray(googleDaily.temperature_2m_min);
  const googleRain = numberArray(googleDaily.precipitation_sum);
  const outlookDates = stringArray(seasonalDaily?.time);
  const outlookTemps = numberArray(seasonalDaily?.temperature_2m_mean);
  const outlookRain = numberArray(seasonalDaily?.precipitation_sum);

  const daily: DailyPoint[] = googleDailyDates.map((date, index) => ({
    date,
    high: googleHighs[index] ?? null,
    low: googleLows[index] ?? null,
    mean: null,
    precipitation: googleRain[index] ?? null,
    outlook: false,
  }));

  const shortRangeEnd = daily.at(-1)?.date ?? "";
  outlookDates.forEach((date, index) => {
    if (date <= shortRangeEnd || daily.length >= 30) return;
    const mean = outlookTemps[index] ?? null;
    daily.push({
      date,
      high: null,
      low: null,
      mean,
      precipitation: outlookRain[index] ?? null,
      outlook: true,
    });
  });

  const currentTemperature = current.temperature_2m;
  const feelsLike = current.apparent_temperature;
  const relativeHumidity = current.relative_humidity_2m;
  const windSpeed = current.wind_speed_10m;
  const currentPrecipitation = current.precipitation;
  const currentCode = current.weather_code;
  if (
    typeof currentTemperature !== "number" ||
    typeof feelsLike !== "number" ||
    typeof relativeHumidity !== "number" ||
    typeof windSpeed !== "number" ||
    typeof currentPrecipitation !== "number" ||
    typeof currentCode !== "number"
  ) {
    throw new Error("Current weather data is incomplete. Please try another location.");
  }

  return {
    timezone: typeof google.timezone === "string" ? google.timezone : "UTC",
    outlookError,
    current: {
      temperature: currentTemperature,
      feelsLike,
      humidity: relativeHumidity,
      windSpeed,
      precipitation: currentPrecipitation,
      weatherCode: currentCode,
    },
    hourly,
    daily,
  };
}

export async function searchLocation(query: string): Promise<WeatherLocation> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const result = await fetchJson(url);
  const first = Array.isArray(result.results) ? result.results[0] : undefined;
  if (!first) throw new Error("No matching place found. Try a nearby city.");
  const place = asRecord(first);
  if (
    typeof place.name !== "string" ||
    typeof place.latitude !== "number" ||
    typeof place.longitude !== "number"
  ) {
    throw new Error("The place search returned incomplete location data.");
  }
  return {
    name: place.name,
    country: typeof place.country === "string" ? place.country : "",
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export function weatherDescription(code: number): string {
  if (code === 0) return "Clear skies";
  if ([1, 2].includes(code)) return "Mostly clear";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain showers";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Partly cloudy";
}

export function weatherIcon(code: number) {
  if (code === 0) return "sun";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([1, 2].includes(code)) return "partly";
  return "cloud";
}

export function formatTemperature(celsius: number, unit: "C" | "F"): number {
  return Math.round(unit === "C" ? celsius : (celsius * 9) / 5 + 32);
}

export function formatDay(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}
