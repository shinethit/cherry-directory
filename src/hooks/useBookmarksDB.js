import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';

const BOOKMARKS_QUERY_KEY = 'bookmarks';

/**
 * Fetch user's bookmarks
 */
export const useBookmarks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [BOOKMARKS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!user,
  });
};

/**
 * Check if a listing is bookmarked
 */
export const useIsBookmarked = (listingId) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [BOOKMARKS_QUERY_KEY, user?.id, listingId],
    queryFn: async () => {
      if (!user || !listingId) return false;

      const { data, error } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', 'listing')
        .eq('target_id', listingId)
        .single();

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
        .insert([
          {
            user_id: user.id,
            target_type: targetType,
            target_id: targetId,
          },
        ])
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Add Bookmark');
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
    },
  });
};

/**
 * Remove bookmark
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
    },
  });
};

/**
 * Toggle bookmark
 */
export const useToggleBookmark = () => {
  const addBookmark = useAddBookmark();
  const removeBookmark = useRemoveBookmark();
  const { data: isBookmarked } = useIsBookmarked();

  return useMutation({
    mutationFn: async ({ targetId, targetType = 'listing' }) => {
      if (isBookmarked) {
        await removeBookmark.mutateAsync({ targetId, targetType });
      } else {
        await addBookmark.mutateAsync({ targetId, targetType });
      }
    },
  });
};
