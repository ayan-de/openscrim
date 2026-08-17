'use client';

import Image from 'next/image';
import type { User } from '../types/auth';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function UserAvatar({
  user,
  size = 'sm',
  className = '',
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      {user.picture ? (
        <Image
          src={user.picture}
          alt={`${user.firstName} ${user.lastName}`}
          width={32}
          height={32}
          className="w-full h-full rounded-full object-cover border-2 border-border cursor-pointer"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-muted border-2 border-border flex items-center justify-center text-foreground font-semibold cursor-pointer">
          {getInitials(user.firstName, user.lastName)}
        </div>
      )}
    </div>
  );
}
