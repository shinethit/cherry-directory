import { useEffect } from 'react';
import { supabase, realtimeEnabled } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../lib/notificationService';
import { handleSupabaseError } from '../lib/errorHandler';
import { showError } from '../lib/toast';

const NOTIFICATIONS_QUERY_KEY = 'notifications';

/**
 * Fetch user notifications
 */
export const useNotifications = (limit = 20) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];
      return getUserNotifications(user.id, limit);
    },
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
  });
};

/**
 * Get unread notification count — S31 (v9.17): a count query, not a
 * count of the capped (20-row) page, which under-reported the badge.
 */
export const useUnreadNotificationCount = () => {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['unread-notification-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
    // v9.18: with realtime off (proxied origin) the badge never gets a
    // push — refetch the count every 60 s instead. With realtime on, the
    // subscription invalidates the query, so no timer is needed.
    refetchInterval: realtimeEnabled ? false : 60000,
  });

  return data ?? 0;
};

/**
 * Mark notification as read
 */
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId) => {
      return markNotificationAsRead(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count', user?.id] });
    },
    onError: (err) => {
      showError(err?.message || 'ဖတ်ပြီးအဖြစ် မှတ်မရပါ');
    },
  });
};

/**
 * Mark all notifications as read
 */
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      return markAllNotificationsAsRead(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count', user?.id] });
    },
    onError: (err) => {
      showError(err?.message || 'အားလုံးဖတ်ပြီးအဖြစ် မှတ်မရပါ');
    },
  });
};

/**
 * Delete notification
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId) => {
      return deleteNotification(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count', user?.id] });
    },
    onError: (err) => {
      showError(err?.message || 'ဖျက်မရပါ — ထပ်ကြိုးစားပါ');
    },
  });
};

/**
 * Subscribe to real-time notifications
 */
export const useNotificationSubscription = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const subscription = subscribeToNotifications(user.id, (newNotification) => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, user.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count', user.id] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, queryClient]);
};
