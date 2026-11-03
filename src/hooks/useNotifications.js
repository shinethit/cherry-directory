import { useEffect } from 'react';
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
 * Get unread notification count
 */
export const useUnreadNotificationCount = () => {
  const { user } = useAuth();
  const { data: notifications = [] } = useNotifications();

  return notifications.filter((n) => !n.is_read).length;
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
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, queryClient]);
};
