'use client';

import { useState, useRef, useEffect } from 'react';
import { User } from '../types/auth';
import UserAvatar from './UserAvatar';
import { useAuth } from '../hooks/useAuth';
import { useLoading } from '../context/LoadingContext';
import { useRouter } from 'next/navigation';

interface UserMenuProps {
  user: User;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { showLoading, showSuccess, showError } = useLoading();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      showLoading('Signing you out...');
      await logout();
      showSuccess('You have been signed out successfully!');
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Failed to sign out. Please try again.');
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex flex-row gap-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 hover:bg-muted rounded-full p-1 transition-all duration-300"
        >
          <UserAvatar user={user} size="sm" />
          <span className="hidden md:block text-foreground text-sm font-medium">
            {user.firstName}
          </span>
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center bg-secondary text-secondary-foreground space-x-1 text-sm font-semibold hover:bg-secondary/80 rounded-full px-2 py-1 transition-all duration-300 cursor-pointer"
        >
          Dashboard
        </button>
      </div>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground backdrop-blur-md border border-border rounded-lg shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-popover-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
