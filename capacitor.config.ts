import type { CapacitorConfig } from "@capacitor/cli";

// The native shell loads the live web app, so every web update reaches installed phones instantly.
const config: CapacitorConfig = {
  appId: "app.summit.game",
  appName: "summ-it",
  webDir: "public",
  server: { url: "https://summ-it.lovable.app", cleartext: false },
};

export default config;
