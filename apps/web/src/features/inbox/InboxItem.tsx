import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlatformIcon, getTypeConfig, formatRelativeTime } from './inbox-utils';

interface InboxItemProps {
  interaction: any;
  isSelected: boolean;
  onClick: () => void;
}

export function InboxItem({ interaction, isSelected, onClick }: InboxItemProps) {
  const typeConfig = getTypeConfig(interaction.type);
  const isUnread = !interaction.isRead;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 p-3 cursor-pointer border-b transition-colors hover:bg-gray-50',
        isSelected && 'bg-blue-50 hover:bg-blue-50 border-l-2 border-l-primary',
        isUnread && !isSelected && 'bg-white font-medium',
        !isUnread && !isSelected && 'bg-gray-50/50',
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={interaction.senderAvatarUrl} />
          <AvatarFallback className="text-xs">
            {interaction.senderName?.charAt(0)?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {/* Platform icon overlay */}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
          <PlatformIcon
            platform={interaction.socialAccount?.platform}
            size={12}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'text-sm truncate',
                isUnread ? 'font-semibold text-gray-900' : 'text-gray-700',
              )}
            >
              {interaction.senderName}
            </span>
            {isUnread && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatRelativeTime(interaction.receivedAt)}
          </span>
        </div>

        {/* Message preview */}
        <p
          className={cn(
            'text-sm mt-0.5 line-clamp-2',
            isUnread ? 'text-gray-700' : 'text-muted-foreground',
          )}
        >
          {interaction.messageText}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
              typeConfig.color,
            )}
          >
            {typeConfig.label}
          </span>

          {interaction.socialAccount?.displayName && (
            <span className="text-[10px] text-muted-foreground truncate">
              on {interaction.socialAccount.displayName}
            </span>
          )}

          {interaction.isReplied && (
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              Replied
            </Badge>
          )}

          {interaction._count?.replies > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {interaction._count.replies} replies
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
