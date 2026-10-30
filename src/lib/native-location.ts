import { isNativeApp } from "@/lib/health-connect";

/**
 * Inside the native Android shell the WebView cannot raise the system permission
 * dialog on its own — the app has to ask for the runtime permission first.
 * Without that grant Android hands out only a coarse network fix (~2000 m),
 * which every GPS rule in the game correctly rejects.
 *
 * Resolves silently in the browser, where the browser itself shows the prompt.
 */
export async function ensureLocationPermission(): Promise<void> {
  if (!isNativeApp()) return;
  const { Geolocation } = await import("@capacitor/geolocation");
  const status = await Geolocation.requestPermission();
  if (status.location !== "granted") {
    throw new Error("Přístup k poloze byl zamítnut. Povolte polohu v nastavení aplikace.");
  }
}
