import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "4Cast — your forecast, thoughtfully",
    short_name: "4Cast",
    description: "A personal weather forecast and alerts dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fc",
    theme_color: "#314974",
    icons: [
      {
        src: "/weather-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
