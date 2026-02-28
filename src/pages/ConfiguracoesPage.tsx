const SETTINGS_KEY = "risezap_settings";

export interface AppSettings {
  confirmFunnelSend: boolean;
}

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { confirmFunnelSend: true, ...JSON.parse(raw) };
  } catch {}
  return { confirmFunnelSend: true };
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
