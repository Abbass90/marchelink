import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// CLAUDE.md §23 : pino structuré JSON. info en prod, debug en dev.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  }),
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.password_hash'],
});
