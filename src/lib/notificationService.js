import { supabase } from './supabase';
import { handleSupabaseError } from './errorHandler';

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  LISTING_APPROVED: 'listing_approved',
  LISTING_REJECTED: 'listing_rejected',
  NEW_REVIEW: 'new_review',
  REVIEW_APPROVED: 'review_approved',
  FUEL_STATUS_UPDATE: 'fuel_status_update',
  NEW_MESSAGE: 'new_message',
  SYSTEM_ALERT: 'system_alert',
};

/**
 * Create notification
 */
export const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type,
          title,
          message,
          data,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'Create Notification');
      throw error;
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
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
    console.error('Failed to fetch notifications:', error);
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
    console.error('Failed to mark notification as read:', error);
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
    console.error('Failed to mark all notifications as read:', error);
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
    console.error('Failed to delete notification:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (userId, callback) => {
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

/**
 * Send listing approval notification
 */
export const notifyListingApproved = async (userId, listingName) => {
  return createNotification(
    userId,
    NOTIFICATION_TYPES.LISTING_APPROVED,
    'စာရင်း အတည်ပြုခဲ့သည်',
    `"${listingName}" စာရင်းကို အတည်ပြုခဲ့သည်။`,
    { listing_name: listingName }
  );
};

/**
 * Send listing rejection notification
 */
export const notifyListingRejected = async (userId, listingName, reason = '') => {
  return createNotification(
    userId,
    NOTIFICATION_TYPES.LISTING_REJECTED,
    'စာရင်း ငြင်းပယ်ခဲ့သည်',
    `"${listingName}" စာရင်းကို ငြင်းပယ်ခဲ့သည်။ ${reason ? `အကြောင်းအရာ: ${reason}` : ''}`,
    { listing_name: listingName, reason }
  );
};

/**
 * Send new review notification
 */
export const notifyNewReview = async (userId, listingName, reviewerName, rating) => {
  return createNotification(
    userId,
    NOTIFICATION_TYPES.NEW_REVIEW,
    'အဆင့်သတ်မှတ်မှု အသစ်',
    `${reviewerName} က "${listingName}" အတွက် ${rating} ⭐ အဆင့်သတ်မှတ်ခဲ့သည်။`,
    { listing_name: listingName, reviewer_name: reviewerName, rating }
  );
};

/**
 * Send fuel status update notification
 */
export const notifyFuelStatusUpdate = async (userId, stationName, fuelType, status) => {
  return createNotification(
    userId,
    NOTIFICATION_TYPES.FUEL_STATUS_UPDATE,
    'ဆီ အခြေအနေ အဆင့်မြှင့်တင်မှု',
    `${stationName} တွင် ${fuelType} ဆီ အခြေအနေ: ${status}`,
    { station_name: stationName, fuel_type: fuelType, status }
  );
};
