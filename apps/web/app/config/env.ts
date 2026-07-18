/* eslint-disable turbo/no-undeclared-env-vars */

export const env = {
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',

  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'OpenScrim',
  APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  MAX_RECORDING_DURATION:
    Number(process.env.NEXT_PUBLIC_MAX_RECORDING_DURATION) || 300000,
  AUTO_SAVE_RECORDINGS: process.env.NEXT_PUBLIC_AUTO_SAVE_RECORDINGS === 'true',

  // Detaches the backend entirely: no session fetch, auth always off,
  // storage stays in IndexedDB. For frontend/DOM development.
  LOCAL_ONLY: process.env.NEXT_PUBLIC_LOCAL_ONLY === 'true',

  DEBUG_RECORDING: process.env.NEXT_PUBLIC_DEBUG_RECORDING === 'true',
  DEBUG_MONACO: process.env.NEXT_PUBLIC_DEBUG_MONACO === 'true',

  isDevelopment: () => process.env.NODE_ENV === 'development',
  isProduction: () => process.env.NODE_ENV === 'production',
  isTest: () => process.env.NODE_ENV === 'test',
} as const;

export type Environment = typeof env;
