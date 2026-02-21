import { Facebook, Instagram, Linkedin, Twitter, Music2, Pin } from 'lucide-react';

const platformConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  FACEBOOK: {
    label: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  INSTAGRAM: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  LINKEDIN: {
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  TWITTER: {
    label: 'X (Twitter)',
    icon: Twitter,
    color: 'text-gray-900',
    bgColor: 'bg-gray-50',
  },
  TIKTOK: {
    label: 'TikTok',
    icon: Music2,
    color: 'text-black',
    bgColor: 'bg-gray-50',
  },
  PINTEREST: {
    label: 'Pinterest',
    icon: Pin,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

export function getPlatformConfig(platform: string) {
  return platformConfig[platform] || platformConfig.TWITTER;
}

export function PlatformIcon({
  platform,
  size = 16,
  className = '',
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const config = getPlatformConfig(platform);
  const Icon = config.icon;
  return <Icon size={size} className={`${config.color} ${className}`} />;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  COMMENT: { label: 'Comment', color: 'bg-blue-100 text-blue-800' },
  REPLY: { label: 'Reply', color: 'bg-purple-100 text-purple-800' },
  DM: { label: 'DM', color: 'bg-green-100 text-green-800' },
  MENTION: { label: 'Mention', color: 'bg-orange-100 text-orange-800' },
  REVIEW: { label: 'Review', color: 'bg-yellow-100 text-yellow-800' },
};

export function getTypeConfig(type: string) {
  return typeLabels[type] || typeLabels.COMMENT;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
