import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "National Sports Registration Platform",
    short_name: "Kenya Sports",
    description: "Register, verify and manage sports in Kenya.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7fb",
    theme_color: "#062d57",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
