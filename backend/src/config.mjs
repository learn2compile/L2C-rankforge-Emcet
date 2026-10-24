const csv = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  allowedOrigins: csv(process.env.ALLOWED_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200'),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  sessionTtlDays: Math.max(1, Math.min(30, Number.parseInt(process.env.SESSION_TTL_DAYS || '7', 10))),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
  emailDeliveryUrl: process.env.EMAIL_DELIVERY_URL || '',
  emailDeliveryToken: process.env.EMAIL_DELIVERY_TOKEN || '',
  smsDeliveryUrl: process.env.SMS_DELIVERY_URL || '',
  smsDeliveryToken: process.env.SMS_DELIVERY_TOKEN || '',
  exposeDevCodes: process.env.AUTH_EXPOSE_DEV_CODES === 'true',
  oauthStateSecret: process.env.OAUTH_STATE_SECRET || '',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

if (config.isProduction && config.exposeDevCodes) {
  throw new Error('AUTH_EXPOSE_DEV_CODES must be false in production.');
}
if (config.isProduction && (!config.databaseUrl || !config.databaseSsl)) {
  throw new Error('DATABASE_URL and DATABASE_SSL=true are required in production.');
}
if (config.isProduction && !config.emailDeliveryUrl) {
  throw new Error('EMAIL_DELIVERY_URL must be configured in production for verification and password recovery.');
}
if (config.isProduction && (config.oauthStateSecret.length < 32 || config.oauthStateSecret.includes('replace-this'))) {
  throw new Error('OAUTH_STATE_SECRET must be replaced with a strong random secret in production.');
}
