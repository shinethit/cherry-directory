import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';
import { validateReview } from '../lib/validation';

const REVIEWS_QUERY_KEY = 'reviews';

/**
 * Fetch reviews for a listing
 */
export const useReviews = (listingId) => {
  return useQuery({
    queryKey: [REVIEWS_QUERY_KEY, listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles(username, avatar_url)')
        .eq('listing_id', listingId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!listingId,
  });
};

/**
 * Fetch user's review for a listing
 */
export const useUserReview = (listingId) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [REVIEWS_QUERY_KEY, listingId, user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    },
    enabled: !!user && !!listingId,
  });
};

/**
 * Create or update review
 */
export const useCreateReview = (listingId) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewData) => {
      if (!user) {
        throw new Error('အသုံးပြုသူ လက်ခြင်းမထည့်သွင်းရသေးပါ။');
      }

      // Validate review data
      const validation = validateReview({
        listing_id: listingId,
        ...reviewData,
      });

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const { data, error } = await supabase
        .from('reviews')
        .upsert(
          {
            listing_id: listingId,
            user_id: user.id,
            ...reviewData,
          },
          { onConflict: 'listing_id,user_id' }
        )
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Create/Update Review');
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY, listingId] });
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY, listingId, user?.id] });
    },
  });
};

/**
 * Delete review
 */
export const useDeleteReview = (listingId, reviewId) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);

      if (error) {
        handleSupabaseError(error, 'Delete Review');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY, listingId] });
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY, listingId, user?.id] });
    },
  });
};

/**
 * Fetch pending reviews (for admin)
 */
export const usePendingReviews = () => {
  return useQuery({
    queryKey: [REVIEWS_QUERY_KEY, 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, listings(name), profiles(username)')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    },
  });
};

/**
 * Approve review (admin only)
 */
export const useApproveReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId) => {
      const { data, error } = await supabase
        .from('reviews')
        .update({ is_approved: true })
        .eq('id', reviewId)
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Approve Review');
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY] });
    },
  });
};

/**
 * Reject review (admin only)
 */
export const useRejectReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        handleSupabaseError(error, 'Reject Review');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY] });
    },
  });
};
