// Frontend configuration. Public values only — NEVER put secrets here.
export const CONFIG = {
  API_BASE_URL: "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev", // the Cloudflare Worker URL (no trailing slash)
  GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",
};
export const POLICY_VERSION = "2026-10-draft"; // bump when privacy/terms/disclaimer change: users must accept again
export const CONSENT_TYPES = ["privacy_policy", "terms", "medical_disclaimer"];
export const isConfigured = () => !/YOUR[-_]/.test(CONFIG.API_BASE_URL + CONFIG.GOOGLE_CLIENT_ID);
