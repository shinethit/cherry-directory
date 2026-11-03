import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';

const BOOKMARKS_QUERY_KEY = 'bookmarks';

// NOTE: useBookmarks (list all) was deleted in v9.3 — zero consumers;
// pages read bookmark state via useIsBookmarked only.

/**
 * Check if a listing is bookmarked
 */
export const useIsBookmarked = (listingId, targetType = 'listing') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [BOOKMARKS_QUERY_KEY, user?.id, listingId, targetType],
    queryFn: async () => {
      if (!user || !listingId) return false;

      const { data, error } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', listingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    },
    enabled: !!user && !!listingId,
  });
};

/**
 * Add bookmark
 * Upsert on the unique(user_id, target_type, target_id) constraint, so a
 * double-tap that reads bookmarked=false twice cannot hit the constraint
 * with a raw error toast. Optimistic: the icon flips immediately and rolls
 * back on error.
 */
export const useAddBookmark = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, targetType = 'listing' }) => {
      if (!user) {
        throw new Error('အသုံးပြုသူ လက်ခြင်းမထည့်သွင်းရသေးပါ။');
      }

      const { data, error } = await supabase
        .from('bookmarks')
        .upsert(
          [
            {
              user_id: user.id,
              target_type: targetType,
              target_id: targetId,
            },
          ],
          { onConflict: 'user_id,target_type,target_id' }
        )
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Add Bookmark');
        throw error;
      }

      return data;
    },
    onMutate: async ({ targetId, targetType = 'listing' }) => {
      const key = [BOOKMARKS_QUERY_KEY, user?.id, targetId, targetType];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, true);
      return { key, previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
    },
  });
};

/**
 * Remove bookmark — optimistic (icon flips immediately, rolls back on error).
 */
export const useRemoveBookmark = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, targetType = 'listing' }) => {
      if (!user) {
        throw new Error('အသုံးပြုသူ လက်ခြင်းမထည့်သွင်းရသေးပါ။');
      }

      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId);

      if (error) {
        handleSupabaseError(error, 'Remove Bookmark');
        throw error;
      }
    },
    onMutate: async ({ targetId, targetType = 'listing' }) => {
      const key = [BOOKMARKS_QUERY_KEY, user?.id, targetId, targetType];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, false);
      return { key, previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
    },
  });
};

/**
 * Toggle bookmark
 */
// useToggleBookmark removed — broken. Use useAddBookmark + useRemoveBookmark separately.

