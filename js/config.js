// Frontend configuration. Public values only — NEVER put secrets here.
export const CONFIG = {
  API_BASE_URL: "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev", // the Cloudflare Worker URL (no trailing slash)
  GOOGLE_CLIENT_ID: "https://script.google.com/macros/s/AKfycbzXa8fmRnVdtqbO66MruGU7__XIbHm2XLt14DLES0u7MTr9MYdG-JHOivkBonXNE7eJ/exec",
};
export const POLICY_VERSION = "2026-10-draft"; // bump when privacy/terms/disclaimer change: users must accept again
export const CONSENT_TYPES = ["privacy_policy", "terms", "medical_disclaimer"];
export const isConfigured = () => !/YOUR[-_]/.test(CONFIG.API_BASE_URL + CONFIG.GOOGLE_CLIENT_ID);
