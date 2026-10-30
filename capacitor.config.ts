import type { CapacitorConfig } from "@capacitor/cli";

// The native shell loads the live web app, so every web update reaches installed phones instantly.
const config: CapacitorConfig = {
  appId: "app.summit.game",
  appName: "summ-it",
  webDir: "public",
  server: {
    url: "https://summ-it.lovable.app",
    cleartext: false,
    // Keep every summ-it navigation inside the app window instead of handing it to Chrome.
    allowNavigation: ["summ-it.lovable.app", "*.lovable.app"],
  },
};

export default config;
