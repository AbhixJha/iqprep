/**
 * IQPrep API base URL — runs before api.js.
 * 
 * This script sets up the global IQPREP_API_BASE URL.
 * 
 * Priority (highest to lowest):
 * 1. Meta tag: <meta name="iqprep-api-base" content="...">
 * 2. window.IQPREP_API_BASE (if already set)
 * 3. Environment detection:
 *    - Dev: http://127.0.0.1:8080/api
 *    - Production: use same origin with /api suffix
 */
(function (g) {
  if (!g || !g.document) return;
  
  // 1. Check for meta tag override
  var meta = g.document.querySelector('meta[name="iqprep-api-base"]');
  if (meta && meta.content && String(meta.content).trim()) {
    g.IQPREP_API_BASE = String(meta.content).trim().replace(/\/$/, '');
    return;
  }
  
  // 2. Already set?
  if (g.IQPREP_API_BASE) return;
  
  // 3. Auto-detect based on environment
  var loc = g.location;
  if (loc && /^https?:/i.test(loc.protocol || '')) {
    var host = loc.hostname || '';
    var port = loc.port || '';
    
    // Development environment: backend always on 8080
    if (host === 'localhost' || host === '127.0.0.1') {
      g.IQPREP_API_BASE = 'http://127.0.0.1:8080/api';
      return;
    }
    
    // Production: use same origin
    var origin = loc.origin || (loc.protocol + '//' + host + (port ? ':' + port : ''));
    g.IQPREP_API_BASE = origin.replace(/\/$/, '') + '/api';
    return;
  }
  
  // Fallback
  g.IQPREP_API_BASE = 'http://127.0.0.1:8080/api';
})(typeof window !== 'undefined' ? window : globalThis);
