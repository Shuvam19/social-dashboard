import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interactionsApi } from '@/lib/api';
import { useInboxSocket } from './useInboxSocket';
import { InboxItem } from './InboxItem';
import { InboxDetail } from './InboxDetail';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  MessageSquare,
  Mail,
  AtSign,
  MessagesSquare,
  Search,
  CheckCheck,
  RefreshCw,
  Wifi,
  WifiOff,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'COMMENT' | 'REPLY' | 'DM' | 'MENTION';
type FilterStatus = 'all' | 'unread' | 'unreplied';

export function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Real-time WebSocket connection
  const { isConnected, resetUnreadCount } = useInboxSocket({
    onNewInteraction: useCallback((interaction: any) => {
      toast({
        title: `New ${interaction.type?.toLowerCase() || 'message'}`,
        description: `${interaction.senderName}: ${interaction.messageText?.slice(0, 80)}...`,
      });
    }, [toast]),
  });

  // Fetch interactions
  const { data: interactions = [], isLoading, refetch } = useQuery({
    queryKey: ['interactions', typeFilter, statusFilter, searchQuery],
    queryFn: () =>
      interactionsApi.getAll({
        type: typeFilter === 'all' ? undefined : typeFilter,
        isReplied: statusFilter === 'unreplied' ? false : undefined,
        isRead: statusFilter === 'unread' ? false : undefined,
        search: searchQuery || undefined,
        limit: 100,
      }),
    refetchInterval: 30000, // Fallback poll every 30s
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['interactions-stats'],
    queryFn: () => interactionsApi.getStats(),
    refetchInterval: 60000,
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => interactionsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-stats'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-unread'] });
      resetUnreadCount();
      toast({ title: 'All marked as read' });
    },
  });

  // Get the selected interaction's full data
  const { data: selectedInteraction } = useQuery({
    queryKey: ['interaction', selectedId],
    queryFn: () => interactionsApi.getById(selectedId!),
    enabled: !!selectedId,
  });

  // Type filter tabs config
  const filterTabs = useMemo(
    () => [
      {
        value: 'all' as const,
        label: 'All',
        icon: Inbox,
        count: stats?.total,
      },
      {
        value: 'COMMENT' as const,
        label: 'Comments',
        icon: MessageSquare,
        count: stats?.byType?.COMMENT,
      },
      {
        value: 'REPLY' as const,
        label: 'Replies',
        icon: MessagesSquare,
        count: stats?.byType?.REPLY,
      },
      {
        value: 'DM' as const,
        label: 'DMs',
        icon: Mail,
        count: stats?.byType?.DM,
      },
      {
        value: 'MENTION' as const,
        label: 'Mentions',
        icon: AtSign,
        count: stats?.byType?.MENTION,
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Manage comments, DMs, and mentions across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
              isConnected
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700',
            )}
          >
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'Live' : 'Offline'}
          </div>

          {stats?.unread ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck size={14} className="mr-1" />
              Mark all read ({stats.unread})
            </Button>
          ) : null}

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Unread</p>
            <p className="text-2xl font-bold text-primary">{stats.unread}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Awaiting Reply</p>
            <p className="text-2xl font-bold text-orange-600">
              {stats.unreplied}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Platforms</p>
            <p className="text-2xl font-bold">
              {Object.keys(stats.byPlatform || {}).length}
            </p>
          </Card>
        </div>
      )}

      {/* Main content: two-panel layout */}
      <div className="flex gap-0 border rounded-lg bg-white overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
        {/* Left panel — Interaction list */}
        <div
          className={cn(
            'w-full lg:w-[380px] xl:w-[420px] flex flex-col border-r',
            selectedId && 'hidden lg:flex',
          )}
        >
          {/* Filters */}
          <div className="p-3 border-b space-y-2">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>

            {/* Type filter tabs */}
            <Tabs
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as FilterType)}
            >
              <TabsList className="w-full h-8">
                {filterTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-1 text-xs gap-1 px-1.5 py-1"
                  >
                    <tab.icon size={12} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-4 min-w-[16px] px-1 text-[10px]"
                      >
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Status filter */}
            <div className="flex gap-1">
              {(['all', 'unread', 'unreplied'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all'
                    ? 'All'
                    : status === 'unread'
                      ? 'Unread'
                      : 'Needs Reply'}
                </Button>
              ))}
            </div>
          </div>

          {/* Interaction list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <RefreshCw size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Inbox size={32} className="mb-2" />
                <p className="text-sm font-medium">No interactions found</p>
                <p className="text-xs mt-1">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'New comments and messages will appear here'}
                </p>
              </div>
            ) : (
              <div>
                {interactions.map((interaction: any) => (
                  <InboxItem
                    key={interaction.id}
                    interaction={interaction}
                    isSelected={selectedId === interaction.id}
                    onClick={() => setSelectedId(interaction.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel — Detail view */}
        <div
          className={cn(
            'flex-1 flex flex-col',
            !selectedId && 'hidden lg:flex',
          )}
        >
          {selectedInteraction ? (
            <InboxDetail
              interaction={selectedInteraction}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare size={48} className="mb-3 opacity-50" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">
                Choose an interaction from the list to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
