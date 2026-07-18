'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useLoading } from '../../context/LoadingContext';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { showSuccess, showError } = useLoading();

  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (isLoading) return;

    if (errorParam) {
      const errorMessage =
        errorParam === 'missing_code'
          ? 'No authorization code received'
          : decodeURIComponent(errorParam);
      showError(errorMessage);
      setTimeout(() => router.push('/'), 3000);
      return;
    }

    if (user) {
      showSuccess('You have been signed in successfully!');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      return;
    }

    if (!isAuthenticated) {
      router.push('/');
    }
  }, [
    user,
    isLoading,
    isAuthenticated,
    errorParam,
    showError,
    showSuccess,
    router,
  ]);

  return null;
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
