# 4Cast

A responsive, installable weather dashboard built with Next.js and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app uses browser geolocation only when you choose **Use my current location**; otherwise, search for a city or use the initial San Francisco location.

## Forecast data

- Short-range ensemble forecasts use Google DeepMind's WeatherNext 2 through the Open-Meteo Ensemble API (`google_weathernext2_ensemble`).
- Current conditions, humidity, and precipitation probability use the Open-Meteo Forecast API.
- The 30-day view combines the 16-day WeatherNext forecast with the Open-Meteo EC46 seasonal outlook. Days 17–30 are indicative seasonal guidance, not precise daily predictions.
- Open-Meteo API access is used without an API key. Review its current terms before a commercial launch.

## Alerts and installation

Alert thresholds and the selected location are saved in this browser. Browser notifications are evaluated while the app is open. Reliable background push requires a server-side scheduler, push subscription storage, and notification service; those are not included in this client-only starter.

The web manifest enables installation on supported devices when deployed over HTTPS. iOS web push additionally requires Home Screen installation and a push service worker/backend.

## Forecast limitations

WeatherNext is an experimental research model and its longer-range uncertainty grows with lead time. Use official local weather services for warnings and safety-critical decisions; this app does not replace official alerts.
