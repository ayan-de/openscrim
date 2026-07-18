'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { env } from '../config/env';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  if (env.LOCAL_ONLY) {
    return <>{children}</>;
  }
  return <SessionProvider>{children}</SessionProvider>;
}
