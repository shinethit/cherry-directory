import { supabase, realtimeEnabled } from './supabase';

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  LISTING_APPROVED: 'listing_approved',
  LISTING_REJECTED: 'listing_rejected',
  NEW_REVIEW: 'new_review',
  REVIEW_APPROVED: 'review_approved',
  NEW_MESSAGE: 'new_message',
  SYSTEM_ALERT: 'system_alert',
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userId, limit = 20) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.warn('Failed to fetch notifications:', error?.message || error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.warn('Failed to mark notification as read:', error?.message || error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Failed to mark all notifications as read:', error?.message || error);
    throw error;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Failed to delete notification:', error?.message || error);
    throw error;
  }
};

/**
 * Subscribe to real-time notifications.
 * v9.18: no-op when realtime is off (proxied origin — see supabase.js);
 * the caller gets a dummy subscription whose unsubscribe() does nothing,
 * so the unread badge falls back to its refetchInterval instead.
 */
export const subscribeToNotifications = (userId, callback) => {
  if (!realtimeEnabled) return { unsubscribe() {} }
  const subscription = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return subscription;
};




