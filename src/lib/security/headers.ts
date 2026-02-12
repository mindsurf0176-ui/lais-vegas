// ========================================
// AI Casino - Security Headers
// ========================================

export const securityHeaders = {
  // Prevent XSS attacks
  'X-XSS-Protection': '1; mode=block',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy (disable dangerous features)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs these
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' wss: ws: https://qvfpaztufoiobgzicoki.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  
  // HSTS (only in production)
  ...(process.env.NODE_ENV === 'production' ? {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  } : {}),
};

// CORS configuration
export const corsConfig = {
  development: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
  production: {
    origin: [
      'https://lais-vegas.com',
      'https://www.lais-vegas.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
};

export function getCorsOrigin(): string | string[] {
  return process.env.NODE_ENV === 'production'
    ? corsConfig.production.origin
    : corsConfig.development.origin;
}
