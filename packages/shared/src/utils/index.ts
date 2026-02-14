import { Platform } from '../types/enums.js';

/**
 * Platform display names
 */
export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
  [Platform.PINTEREST]: 'Pinterest',
};

/**
 * Platform colors for UI
 */
export const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.FACEBOOK]: '#1877F2',
  [Platform.INSTAGRAM]: '#E4405F',
  [Platform.LINKEDIN]: '#0A66C2',
  [Platform.TWITTER]: '#000000',
  [Platform.TIKTOK]: '#000000',
  [Platform.PINTEREST]: '#E60023',
};

/**
 * Platform icons (using Lucide icon names)
 */
export const PLATFORM_ICONS: Record<Platform, string> = {
  [Platform.FACEBOOK]: 'facebook',
  [Platform.INSTAGRAM]: 'instagram',
  [Platform.LINKEDIN]: 'linkedin',
  [Platform.TWITTER]: 'twitter',
  [Platform.TIKTOK]: 'music',
  [Platform.PINTEREST]: 'pin',
};

/**
 * Platform character limits for posts
 */
export const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  [Platform.FACEBOOK]: 63206,
  [Platform.INSTAGRAM]: 2200,
  [Platform.LINKEDIN]: 3000,
  [Platform.TWITTER]: 280,
  [Platform.TIKTOK]: 2200,
  [Platform.PINTEREST]: 500,
};

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a random string for state parameter
 */
export function generateRandomState(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format number with K/M/B suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Format currency amount from cents/micros
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Check if content exceeds platform limit
 */
export function checkContentLimit(content: string, platform: Platform): {
  isValid: boolean;
  remaining: number;
  limit: number;
} {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const remaining = limit - content.length;
  return {
    isValid: remaining >= 0,
    remaining,
    limit,
  };
}
