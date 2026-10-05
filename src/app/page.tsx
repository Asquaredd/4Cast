"use client";

import {
  Bell,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  LocateFixed,
  MapPin,
  Search,
  Sun,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DailyPoint,
  fetchWeather,
  formatDay,
  formatTemperature,
  HourlyPoint,
  searchLocation,
  WeatherData,
  WeatherLocation,
  weatherDescription,
  weatherIcon,
} from "@/lib/weather";

const DEFAULT_LOCATION: WeatherLocation = {
  name: "San Francisco",
  country: "United States",
  latitude: 37.7749,
  longitude: -122.4194,
};

type AlertPreferences = {
  rainChance: number;
  humidity: number;
  heat: number;
  enabled: boolean;
};

const DEFAULT_ALERTS: AlertPreferences = {
  rainChance: 60,
  humidity: 80,
  heat: 32,
  enabled: false,
};

function ConditionIcon({
  code,
  size = 24,
}: {
  code: number | null;
  size?: number;
}) {
  const kind = code === null ? "cloud" : weatherIcon(code);
  const props = { size, strokeWidth: 1.7, "aria-hidden": true as const };
  if (kind === "sun") return <Sun {...props} />;
  if (kind === "partly") return <CloudSun {...props} />;
  if (kind === "fog") return <CloudFog {...props} />;
  if (kind === "drizzle") return <CloudDrizzle {...props} />;
  if (kind === "rain") return <CloudRain {...props} />;
  if (kind === "snow") return <CloudSnow {...props} />;
  if (kind === "storm") return <CloudLightning {...props} />;
  return <Cloud {...props} />;
}

function timeLabel(value: string) {
  const time = value.slice(11, 16);
  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);
  return `${hour % 12 || 12}${minute === "00" ? "" : `:${minute}`}${hour >= 12 ? "pm" : "am"}`;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function dayLabel(point: DailyPoint, index: number) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${point.date}T12:00:00Z`));
}

function getNextHours(data: WeatherData, currentTime: Date): HourlyPoint[] {
  const localNow = currentTime.toLocaleString("sv-SE", {
    timeZone: data.timezone,
    hour12: false,
  });
  const hourKey = localNow.slice(0, 13).replace(" ", "T");
  const start = Math.max(0, data.hourly.findIndex((point) => point.time >= hourKey));
  return data.hourly.slice(start, start + 12);
}

function validSavedLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as Partial<WeatherLocation>;
  return (
    typeof location.name === "string" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  );
}

function validAlertPreferences(value: unknown): value is AlertPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Partial<AlertPreferences>;
  return (
    typeof preferences.rainChance === "number" &&
    typeof preferences.humidity === "number" &&
    typeof preferences.heat === "number" &&
    typeof preferences.enabled === "boolean"
  );
}

function readSavedValue(key: string): unknown {
  const value = localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    console.warn(`Ignoring invalid saved setting: ${key}`);
    localStorage.removeItem(key);
    return null;
  }
}

export default function Home() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [horizon, setHorizon] = useState<7 | 16 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [alerts, setAlerts] = useState<AlertPreferences>(DEFAULT_ALERTS);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lastNotification = useRef("");

  const loadWeather = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWeather(location);
      setWeather(result);
    } catch (cause) {
      setWeather(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load weather right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLocation = readSavedValue("weatherly-location");
      if (validSavedLocation(savedLocation)) setLocation(savedLocation);

      const savedAlerts = readSavedValue("weatherly-alerts");
      if (validAlertPreferences(savedAlerts)) setAlerts(savedAlerts);

      const savedUnit = localStorage.getItem("weatherly-unit");
      if (savedUnit === "C" || savedUnit === "F") setUnit(savedUnit);
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
      setNow(new Date());
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    const timer = window.setTimeout(() => void loadWeather(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWeather, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem("weatherly-location", JSON.stringify(location));
  }, [location, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem("weatherly-alerts", JSON.stringify(alerts));
  }, [alerts, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem("weatherly-unit", unit);
  }, [unit, preferencesReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const refreshTimer = window.setInterval(() => void loadWeather(), 30 * 60_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
    };
  }, [loadWeather]);

  const upcomingHours = useMemo(
    () => (weather ? getNextHours(weather, now) : []),
    [weather, now],
  );
  const visibleDays = useMemo(
    () => weather?.daily.slice(0, horizon) ?? [],
    [weather, horizon],
  );

  useEffect(() => {
    if (!weather || !alerts.enabled || notificationPermission !== "granted") return;
    const next = getNextHours(weather, now);
    const rain = next.find((hour) => (hour.precipitationProbability ?? 0) >= alerts.rainChance);
    const humid = next.find((hour) => (hour.humidity ?? 0) >= alerts.humidity);
    const hot = next.find(
      (hour) => (hour.temperature ?? Number.NEGATIVE_INFINITY) >= alerts.heat,
    );
    const events = [
      rain && {
        key: `rain-${rain.time}`,
        title: "Rain on the way",
        body: `${alerts.rainChance}%+ chance near ${timeLabel(rain.time)}.`,
      },
      humid && {
        key: `humidity-${humid.time}`,
        title: "Humidity alert",
        body: `Humidity may reach ${Math.round(humid.humidity ?? 0)}% near ${timeLabel(humid.time)}.`,
      },
      hot && {
        key: `heat-${hot.time}`,
        title: "Heat alert",
        body: `Temperatures may reach ${formatTemperature(hot.temperature ?? 0, unit)}°${unit} near ${timeLabel(hot.time)}.`,
      },
    ].filter((event): event is NonNullable<typeof event> => Boolean(event));
    events.forEach((event) => {
      const notificationKey = `${location.latitude},${location.longitude}:${dateKey(event.key)}:${event.key}`;
      const storageKey = `weatherly-notified:${notificationKey}`;
      if (lastNotification.current === notificationKey || localStorage.getItem(storageKey)) return;
      lastNotification.current = notificationKey;
      new Notification(event.title, { body: event.body, tag: notificationKey });
      localStorage.setItem(storageKey, "sent");
    });
  }, [alerts, location, now, notificationPermission, unit, weather]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    setSearching(true);
    setError("");
    try {
      setLocation(await searchLocation(query));
      setSearch("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Place search failed.");
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location access is not supported by this browser.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          name: "Your location",
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => setError("Location access was denied or unavailable. Search for a city instead."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setAlerts((current) => ({ ...current, enabled: true }));
    }
  }

  function updateAlert<K extends keyof AlertPreferences>(
    key: K,
    value: AlertPreferences[K],
  ) {
    setAlerts((current) => ({ ...current, [key]: value }));
  }

  const current = weather?.current;
  const currentDescription = current
    ? weatherDescription(current.weatherCode)
    : "Weather at a glance";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: weather?.timezone ?? undefined,
  }).format(now);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="4Cast home">
          <span className="brand-mark"><Sun size={20} strokeWidth={2} /></span>
          <span>4<span className="brand-light">Cast</span></span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="nav-link nav-link-active" href="#forecast">Forecast</a>
          <button className="nav-link" onClick={() => setShowAlerts(true)}>My alerts</button>
        </nav>

        <div className="top-actions">
          <form className="search-form" onSubmit={submitSearch}>
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Search city"
              placeholder="Search city..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {searching && <span className="search-spinner" aria-label="Searching" />}
          </form>
          <button className="icon-button location-button" onClick={useCurrentLocation} aria-label="Use my current location" title="Use my current location">
            <LocateFixed size={18} />
          </button>
          <div className="unit-toggle" aria-label="Temperature unit">
            <button className={unit === "C" ? "selected" : ""} onClick={() => setUnit("C")} aria-pressed={unit === "C"}>°C</button>
            <button className={unit === "F" ? "selected" : ""} onClick={() => setUnit("F")} aria-pressed={unit === "F"}>°F</button>
          </div>
        </div>
      </header>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">{formattedDate}</p>
          <h1>{greeting}<span className="title-period">.</span></h1>
          <p className="welcome-copy">Here&apos;s the weather story for your day.</p>
        </div>
        <button className="alerts-open-button" onClick={() => setShowAlerts(true)}>
          <Bell size={17} />
          <span>Manage alerts</span>
          {alerts.enabled && <span className="active-dot" aria-label="Alerts enabled" />}
        </button>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => void loadWeather()} aria-label="Retry loading weather"><span>Retry</span></button>
        </div>
      )}

      <section className="dashboard-grid" aria-label="Current weather">
        <article className="current-card">
          <div className="current-card-top">
            <div className="location-heading">
              <MapPin size={16} />
              <span>{location.name}{location.country ? `, ${location.country}` : ""}</span>
              <ChevronDown size={15} className="location-chevron" />
            </div>
            <span className="live-pill"><span className="live-dot" /> LIVE CONDITIONS</span>
          </div>
          {loading && !weather ? (
            <div className="current-loading"><span className="loading-orb" /><span>Reading the sky...</span></div>
          ) : current ? (
            <div className="current-main">
              <div className="current-temperature">
                <span className="temperature-value">{formatTemperature(current.temperature, unit)}°</span>
                <span className="condition-label">{currentDescription}</span>
                <span className="feels-like">Feels like {formatTemperature(current.feelsLike, unit)}°</span>
              </div>
              <div className="current-sky" aria-hidden="true">
                <div className="sky-glow" />
                <ConditionIcon code={current.weatherCode} size={118} />
                <span className="sky-spark spark-one" />
                <span className="sky-spark spark-two" />
              </div>
            </div>
          ) : (
            <div className="empty-weather">Weather data is temporarily unavailable.</div>
          )}
          <div className="current-divider" />
          <div className="current-metrics">
            <div className="metric">
              <span className="metric-icon humidity-icon"><Droplets size={17} /></span>
              <span className="metric-copy"><span className="metric-label">Humidity</span><strong>{current ? `${current.humidity}%` : "—"}</strong></span>
            </div>
            <div className="metric">
              <span className="metric-icon wind-icon"><Wind size={17} /></span>
              <span className="metric-copy"><span className="metric-label">Wind</span><strong>{current ? `${Math.round(current.windSpeed)} <small>km/h</small>` : "—"}</strong></span>
            </div>
            <div className="metric">
              <span className="metric-icon rain-icon"><CloudRain size={17} /></span>
              <span className="metric-copy"><span className="metric-label">Rain now</span><strong>{current ? `${current.precipitation.toFixed(1)} <small>mm</small>` : "—"}</strong></span>
            </div>
          </div>
        </article>

        <article className="insight-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">A LITTLE AHEAD</span>
              <h2>Today&apos;s outlook</h2>
            </div>
            <span className="sparkle-mark">✳</span>
          </div>
          <div className="outlook-summary">
            <div className="outlook-weather-icon"><ConditionIcon code={upcomingHours[0]?.weatherCode ?? current?.weatherCode ?? null} size={27} /></div>
            <div>
              <strong>{upcomingHours[0]?.temperature != null ? `${formatTemperature(upcomingHours[0].temperature, unit)}°` : "—"}<span> / </span>{weather ? `${formatTemperature(weather.daily[0]?.low ?? current?.temperature ?? 0, unit)}°` : "—"}</strong>
              <p>{currentDescription} with a chance of a change later.</p>
            </div>
          </div>
          <div className="outlook-divider" />
          <div className="outlook-note">
            <span className="note-icon"><Thermometer size={16} /></span>
            <p>
              {upcomingHours.find((hour) => (hour.precipitationProbability ?? 0) >= 40)
                ? `Keep an eye out for showers around ${timeLabel(upcomingHours.find((hour) => (hour.precipitationProbability ?? 0) >= 40)!.time)}.`
                : "No significant rain expected in the next few hours."}
            </p>
          </div>
          <button className="text-action" onClick={() => setShowAlerts(true)}>Personalize weather alerts <span>↗</span></button>
        </article>
      </section>

      <section className="panel hourly-panel" aria-labelledby="hourly-title">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">HOUR BY HOUR</span>
            <h2 id="hourly-title">The next 12 hours</h2>
          </div>
          <span className="subtle-label">Rain chance · temperature</span>
        </div>
        <div className="hourly-list">
          {loading && !weather ? (
            Array.from({ length: 8 }, (_, index) => <div className="hour-skeleton" key={index} />)
          ) : upcomingHours.slice(0, 8).map((hour, index) => (
            <div className={`hour-item ${index === 0 ? "hour-item-now" : ""}`} key={hour.time}>
              <span className="hour-time">{index === 0 ? "Now" : timeLabel(hour.time)}</span>
              <span className="hour-icon"><ConditionIcon code={hour.weatherCode} size={22} /></span>
              <strong>{hour.temperature === null ? "—" : `${formatTemperature(hour.temperature, unit)}°`}</strong>
              <span className="hour-rain"><Droplets size={12} />{hour.precipitationProbability == null ? "—" : `${hour.precipitationProbability}%`}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel forecast-panel" id="forecast" aria-labelledby="forecast-title">
        <div className="panel-heading forecast-heading">
          <div>
            <span className="section-kicker">PLAN WITH CONFIDENCE</span>
            <h2 id="forecast-title">{horizon === 7 ? "Next 7 days" : "The days ahead"}</h2>
          </div>
          <div className="horizon-switch" aria-label="Forecast range">
            {([7, 16, 30] as const).map((days) => (
              <button
                key={days}
                className={horizon === days ? "active" : ""}
                onClick={() => setHorizon(days)}
                aria-pressed={horizon === days}
              >
                {days === 30 ? "30-day" : `${days}-day`}
              </button>
            ))}
          </div>
        </div>
        {horizon === 30 && (
          <div className="outlook-disclaimer">
            <span>{weather?.outlookError ? "Seasonal outlook unavailable" : "30-day outlook"}</span>
            {weather?.outlookError
              ? `${weather.outlookError} Showing the available Google WeatherNext forecast only.`
              : "Days 1–16 use Google WeatherNext 2 ensemble forecasts. Days 17–30 are a lower-confidence seasonal outlook, not day-specific weather predictions."}
          </div>
        )}
        {horizon === 7 ? (
          <div className="week-cards">
            {loading && !weather ? (
              Array.from({ length: 7 }, (_, index) => <div className="week-card week-card-skeleton" key={index} />)
            ) : visibleDays.map((day, index) => {
              const dayCode = weather?.hourly.find((hour) => dateKey(hour.time) === day.date)?.weatherCode ?? null;
              return (
                <article className={`week-card ${index === 0 ? "week-card-today" : ""}`} key={day.date}>
                  <span className="week-card-day">{dayLabel(day, index)}</span>
                  <span className="week-card-date">{formatDay(day.date, { month: "short", day: "numeric" })}</span>
                  <span className="week-card-icon"><ConditionIcon code={dayCode} size={27} /></span>
                  <div className="week-card-temps">
                    <strong>{day.high === null ? "—" : `${formatTemperature(day.high, unit)}°`}</strong>
                    <span>{day.low === null ? "—" : `${formatTemperature(day.low, unit)}°`}</span>
                  </div>
                  <span className="week-card-rain"><Droplets size={13} />{day.precipitation === null ? "—" : `${day.precipitation.toFixed(1)} mm`}</span>
                </article>
              );
            })}
            {!loading && visibleDays.length === 0 && <div className="forecast-loading">No forecast is available for this range.</div>}
          </div>
        ) : (
          <div className="forecast-list forecast-list-long">
            {loading && !weather ? (
              <div className="forecast-loading">Building your forecast…</div>
            ) : visibleDays.map((day, index) => (
              <div className={`forecast-row ${day.outlook ? "outlook-row" : ""}`} key={day.date}>
                <div className="forecast-date">
                  <strong>{dayLabel(day, index)}</strong>
                  {day.outlook && <span>OUTLOOK</span>}
                  {!day.outlook && <span>{formatDay(day.date, { month: "short", day: "numeric" })}</span>}
                </div>
                <span className="forecast-icon"><ConditionIcon code={weather?.hourly.find((hour) => dateKey(hour.time) === day.date)?.weatherCode ?? null} size={20} /></span>
                <span className="forecast-rain"><Droplets size={13} />{day.precipitation === null ? "—" : `${day.precipitation.toFixed(1)} mm`}</span>
                {day.outlook ? (
                  <div className="temperature-mean">
                    {day.mean === null ? "—" : `~${formatTemperature(day.mean, unit)}° avg`}
                  </div>
                ) : (
                  <div className="temperature-range">
                    <span>{day.low === null ? "—" : `${formatTemperature(day.low, unit)}°`}</span>
                    <div className="temperature-track"><span style={{ left: `${Math.min(80, Math.max(5, ((day.low ?? 0) + 10) * 1.4))}%`, width: `${Math.min(62, Math.max(12, ((day.high ?? 0) - (day.low ?? 0)) * 1.7))}%` }} /></div>
                    <strong>{day.high === null ? "—" : `${formatTemperature(day.high, unit)}°`}</strong>
                  </div>
                )}
              </div>
            ))}
            {!loading && visibleDays.length === 0 && <div className="forecast-loading">No forecast is available for this range.</div>}
          </div>
        )}
        <div className="forecast-footer">
          <span><span className="source-dot" /> Current conditions: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Forecast: <a href="https://github.com/google-deepmind/weathernext" target="_blank" rel="noreferrer">Google WeatherNext 2</a>{horizon === 30 ? " + EC46 outlook" : ""}</span>
          <span>Forecast confidence decreases with time</span>
        </div>
      </section>

      <footer className="app-footer">
        <span>Designed for wherever the day takes you.</span>
        <span>Forecasts are guidance, not official severe-weather warnings.</span>
      </footer>

      {showAlerts && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowAlerts(false);
        }}>
          <section className="alert-modal" role="dialog" aria-modal="true" aria-labelledby="alert-title">
            <div className="modal-heading">
              <div className="modal-icon"><Bell size={19} /></div>
              <button className="icon-button modal-close" onClick={() => setShowAlerts(false)} aria-label="Close alerts"><X size={19} /></button>
            </div>
            <span className="section-kicker">YOUR WEATHER, YOUR RULES</span>
            <h2 id="alert-title">Make the forecast yours.</h2>
            <p className="modal-description">Choose what matters to you. We&apos;ll watch the coming hours and let you know when a threshold is reached.</p>
            <div className="alert-rule">
              <div className="rule-title"><span className="rule-icon rain-icon"><CloudRain size={17} /></span><span><strong>Rain chance</strong><small>Notify when rain is likely</small></span><strong className="rule-value">{alerts.rainChance}%</strong></div>
              <input aria-label="Rain chance threshold" type="range" min="20" max="90" step="5" value={alerts.rainChance} onChange={(event) => updateAlert("rainChance", Number(event.target.value))} />
            </div>
            <div className="alert-rule">
              <div className="rule-title"><span className="rule-icon humidity-icon"><Droplets size={17} /></span><span><strong>High humidity</strong><small>Notify when humidity rises above</small></span><strong className="rule-value">{alerts.humidity}%</strong></div>
              <input aria-label="Humidity threshold" type="range" min="40" max="100" step="5" value={alerts.humidity} onChange={(event) => updateAlert("humidity", Number(event.target.value))} />
            </div>
            <div className="alert-rule">
              <div className="rule-title"><span className="rule-icon heat-icon"><Thermometer size={17} /></span><span><strong>Heat threshold</strong><small>Notify when air temperature reaches</small></span><strong className="rule-value">{formatTemperature(alerts.heat, unit)}°{unit}</strong></div>
              <input aria-label="Heat threshold" type="range" min="24" max="42" step="1" value={alerts.heat} onChange={(event) => updateAlert("heat", Number(event.target.value))} />
            </div>
            <div className="notification-info">
              {notificationPermission === "granted"
                ? <><Check size={15} /> Browser notifications are ready while the app is open.</>
                : notificationPermission === "unsupported"
                  ? "This browser does not support notifications."
                  : "Enable browser notifications to receive alerts while the app is open."}
            </div>
            <div className="modal-actions">
              {notificationPermission !== "granted" && notificationPermission !== "unsupported" ? (
                <button className="primary-button" onClick={() => void enableNotifications()}>Enable notifications <Bell size={16} /></button>
              ) : (
                <button className={`primary-button ${alerts.enabled ? "button-enabled" : ""}`} onClick={() => updateAlert("enabled", !alerts.enabled)}>
                  {alerts.enabled ? <><Check size={16} /> Alerts on</> : <>Turn alerts on <Bell size={16} /></>}
                </button>
              )}
              <button className="cancel-button" onClick={() => setShowAlerts(false)}>Done</button>
            </div>
            <p className="modal-footnote">Alerts are evaluated while this page is open. Background push needs a server-side notification service.</p>
          </section>
        </div>
      )}
    </main>
  );
}
