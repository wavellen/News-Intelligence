// NewsIntel Frontend Configuration
// ─────────────────────────────────────────────────────────────────
// Change API_BASE_URL to match your backend deployment.
//
// Options:
//   ''                                    → served from same origin (backend serves frontend at /dashboard)
//   'http://localhost:8000'               → local backend dev
//   'https://your-api.up.railway.app'     → Railway backend API service
//
// For Railway: set the NEWSINTEL_API_URL environment variable on the
// frontend service, or edit this value directly before deploying.
// ─────────────────────────────────────────────────────────────────

window.NEWSINTEL_API_URL = 'https://news-intel-api-production-edb7.up.railway.app';
window.NEWSINTEL_API_KEY = ''; // Add your nip_... API key here if AUTH_MODE is enabled
