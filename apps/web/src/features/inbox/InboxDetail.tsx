import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Reply,
  EyeOff,
  Eye,
  Trash2,
  Clock,
  ExternalLink,
  Send,
  MessageSquare,
  X,
} from 'lucide-react';
import { interactionsApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { PlatformIcon, getTypeConfig, formatRelativeTime } from './inbox-utils';

interface InboxDetailProps {
  interaction: any;
  onClose: () => void;
}

export function InboxDetail({ interaction, onClose }: InboxDetailProps) {
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const typeConfig = getTypeConfig(interaction.type);

  // Auto-mark as read when opened
  const markReadMutation = useMutation({
    mutationFn: () => interactionsApi.markAsRead(interaction.id),
    onSuccess: () => {
      queryClient.setQueryData<any[]>(['interactions'], (old) =>
        old?.map((item) =>
          item.id === interaction.id ? { ...item, isRead: true } : item,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['interactions-unread'] });
    },
  });

  useEffect(() => {
    if (!interaction.isRead) {
      markReadMutation.mutate();
    }
  }, [interaction.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: () => interactionsApi.reply(interaction.id, replyText),
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['interactions'] });
      queryClient.setQueryData<any[]>(['interactions'], (old) =>
        old?.map((item) =>
          item.id === interaction.id ? { ...item, isReplied: true } : item,
        ),
      );
    },
    onSuccess: () => {
      setReplyText('');
      setShowReplyBox(false);
      toast({ title: 'Reply sent', description: 'Your reply has been sent successfully.' });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-stats'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      toast({ title: 'Error', description: 'Failed to send reply.', variant: 'destructive' });
    },
  });

  // Hide mutation
  const hideMutation = useMutation({
    mutationFn: () =>
      interaction.isHidden
        ? interactionsApi.unhide(interaction.id)
        : interactionsApi.hide(interaction.id),
    onMutate: async () => {
      queryClient.setQueryData<any[]>(['interactions'], (old) =>
        old?.map((item) =>
          item.id === interaction.id
            ? { ...item, isHidden: !interaction.isHidden }
            : item,
        ),
      );
    },
    onSuccess: () => {
      toast({
        title: interaction.isHidden ? 'Unhidden' : 'Hidden',
        description: `Interaction ${interaction.isHidden ? 'restored' : 'hidden'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => interactionsApi.delete(interaction.id),
    onMutate: async () => {
      queryClient.setQueryData<any[]>(['interactions'], (old) =>
        old?.filter((item) => item.id !== interaction.id),
      );
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Interaction removed.' });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-stats'] });
      onClose();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (showReplyBox && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyBox]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={interaction.senderAvatarUrl} />
            <AvatarFallback>
              {interaction.senderName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {interaction.senderName}
              </span>
              <PlatformIcon
                platform={interaction.socialAccount?.platform}
                size={14}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={11} />
              {formatRelativeTime(interaction.receivedAt)}
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color}`}
              >
                {typeConfig.label}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
          <X size={18} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Parent context */}
          {interaction.parent && (
            <div className="bg-gray-50 rounded-lg p-3 border-l-2 border-gray-300">
              <p className="text-xs text-muted-foreground mb-1">
                Replying to {interaction.parent.senderName}
              </p>
              <p className="text-sm text-gray-600">
                {interaction.parent.messageText}
              </p>
            </div>
          )}

          {/* Original post context */}
          {interaction.post && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare size={11} />
                On your post
              </p>
              <p className="text-sm text-gray-600 line-clamp-3">
                {interaction.post.contentText}
              </p>
              {interaction.post.platformPostUrl && (
                <a
                  href={interaction.post.platformPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                >
                  View on platform <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          {/* Main message */}
          <div className="bg-white">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {interaction.messageText}
            </p>
          </div>

          {/* Thread replies */}
          {interaction.replies && interaction.replies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Thread ({interaction.replies.length})
              </h4>
              {interaction.replies.map((reply: any) => (
                <div
                  key={reply.id}
                  className="flex items-start gap-2 pl-4 border-l-2 border-gray-200"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={reply.senderAvatarUrl} />
                    <AvatarFallback className="text-xs">
                      {reply.senderName?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {reply.senderName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(reply.receivedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {reply.messageText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status badges */}
          <div className="flex items-center gap-2 pt-2">
            {interaction.isReplied && (
              <Badge variant="success">Replied</Badge>
            )}
            {interaction.isHidden && (
              <Badge variant="warning">Hidden</Badge>
            )}
            {interaction.sentimentScore !== null &&
              interaction.sentimentScore !== undefined && (
                <Badge
                  variant={
                    interaction.sentimentScore > 0.3
                      ? 'success'
                      : interaction.sentimentScore < -0.3
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  Sentiment:{' '}
                  {interaction.sentimentScore > 0.3
                    ? 'Positive'
                    : interaction.sentimentScore < -0.3
                      ? 'Negative'
                      : 'Neutral'}
                </Badge>
              )}
          </div>
        </div>
      </ScrollArea>

      {/* Actions bar */}
      <div className="border-t p-3">
        {showReplyBox ? (
          <div className="space-y-2">
            <Textarea
              ref={replyInputRef}
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[80px] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (replyText.trim()) replyMutation.mutate();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                ⌘+Enter to send
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReplyBox(false);
                    setReplyText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!replyText.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate()}
                >
                  <Send size={14} className="mr-1" />
                  {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowReplyBox(true)}
              className="flex-1"
            >
              <Reply size={14} className="mr-1" />
              Reply
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => hideMutation.mutate()}
              disabled={hideMutation.isPending}
              title={interaction.isHidden ? 'Unhide' : 'Hide'}
            >
              {interaction.isHidden ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this interaction?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
