'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useCallback } from 'react';
import type { User } from '../types/auth';
import { env } from '../config/env';

interface AuthResult {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initiateGitHubLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const localOnlyAuth: AuthResult = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  initiateGitHubLogin: async () => {
    console.warn('Auth is disabled (NEXT_PUBLIC_LOCAL_ONLY=true)');
  },
  logout: async () => {},
};

function useLocalOnlyAuth(): AuthResult {
  return localOnlyAuth;
}

function useSessionAuth(): AuthResult {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const user: User | null = session?.user
    ? {
        _id: session.user._id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        picture: session.user.picture,
        provider: session.user.provider as 'github',
        providerId: session.user.providerId,
      }
    : null;

  const initiateGitHubLogin = useCallback(async () => {
    await signIn('github', { callbackUrl: '/auth/callback' });
  }, []);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: '/' });
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    initiateGitHubLogin,
    logout,
  };
}

export const useAuth = env.LOCAL_ONLY ? useLocalOnlyAuth : useSessionAuth;
