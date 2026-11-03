import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';
import { validateReview } from '../lib/validation';

const REVIEWS_QUERY_KEY = 'reviews';

// NOTE (v9.3): useReviews / useUserReview were deleted — zero consumers;
// ListingDetailPage fetches reviews directly into local state.
// Kept: useCreateReview (used by ListingDetailPage), useDeleteReview,
// and the admin hooks below — verified correct as written; they only
// work once Track 5 adds the admin SELECT/UPDATE/DELETE policies on
// reviews (under current RLS the pending queue reads empty and
// approve/reject fail — see E-20).

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
 * Delete review — owner deletes their own, admin/moderator can delete any.
 * There is no delete button in this hook's own files: the button lives in
 * ListingDetailPage (another cluster's file) — see the patch text in the
 * v0.9.1 report. The DELETE policy comes from the SQL migration.
 */
export const useDeleteReview = (listingId, reviewId) => {
  const { user, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('အကောင့် ဝင်ရောက်ရန် လိုအပ်သည်။');
      // Owners are scoped to their own review; admins/moderators are not.
      let query = supabase.from('reviews').delete().eq('id', reviewId);
      if (!isAdmin && !isModerator) query = query.eq('user_id', user.id);

      const { error } = await query;

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
