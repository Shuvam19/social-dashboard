import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

interface UseInboxSocketOptions {
  enabled?: boolean;
  onNewInteraction?: (interaction: any) => void;
  onInteractionUpdated?: (data: any) => void;
}

export function useInboxSocket(options: UseInboxSocketOptions = {}) {
  const { enabled = true, onNewInteraction, onInteractionUpdated } = options;
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated || !enabled) return;

    // Disconnect existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(`${WS_URL}/inbox`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[Inbox WS] Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Inbox WS] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('[Inbox WS]', data.message, '- Room:', data.room);
    });

    socket.on('error', (error) => {
      console.error('[Inbox WS] Error:', error);
    });

    // Handle new interactions — update TanStack Query cache optimistically
    socket.on('interaction:new', (interaction: any) => {
      console.log('[Inbox WS] New interaction:', interaction.id);

      // Update the interactions list cache
      queryClient.setQueryData<any[]>(
        ['interactions'],
        (old) => {
          if (!old) return [interaction];
          // Prepend new interaction (most recent first)
          return [interaction, ...old];
        },
      );

      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['interactions'] });

      // Update stats
      queryClient.invalidateQueries({ queryKey: ['interactions-stats'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-unread'] });

      // Increment local unread count
      setUnreadCount((prev) => prev + 1);

      // Notify caller
      onNewInteraction?.(interaction);
    });

    // Handle interaction updates (replied, hidden, deleted)
    socket.on('interaction:updated', (data: any) => {
      console.log('[Inbox WS] Interaction updated:', data.interactionId);

      // Update cache optimistically
      queryClient.setQueryData<any[]>(
        ['interactions'],
        (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === data.interactionId
              ? { ...item, ...data }
              : item,
          );
        },
      );

      // Invalidate for consistency
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['interactions-stats'] });

      onInteractionUpdated?.(data);
    });

    // Handle real-time read status from other clients
    socket.on('interaction:read', (data: any) => {
      queryClient.setQueryData<any[]>(
        ['interactions'],
        (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === data.interactionId
              ? { ...item, isRead: true }
              : item,
          );
        },
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [accessToken, isAuthenticated, enabled, queryClient, onNewInteraction, onInteractionUpdated]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [connect]);

  const emitTyping = useCallback(
    (interactionId: string, isTyping: boolean) => {
      socketRef.current?.emit('typing', { interactionId, isTyping });
    },
    [],
  );

  const emitMarkAsRead = useCallback(
    (interactionId: string) => {
      socketRef.current?.emit('markAsRead', { interactionId });
    },
    [],
  );

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    isConnected,
    unreadCount,
    emitTyping,
    emitMarkAsRead,
    resetUnreadCount,
    socket: socketRef.current,
  };
}
