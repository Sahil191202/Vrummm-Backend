import pino from 'pino';

// Secrets must never reach logs. Redaction is a safety net; do not log secrets in the first place.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.pin',
  '*.token',
  '*.secret',
  '*.otp',
  'password',
  'pin',
  'token',
  'secret',
];

export function createLogger({ level = 'info', destination } = {}) {
  return pino(
    {
      level,
      base: { service: 'vrumm-api' },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    },
    destination,
  );
}
