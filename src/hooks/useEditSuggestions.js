import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for managing edit suggestions and moderation workflow
 * Allows users to suggest edits that require admin/moderator approval
 */
export function useEditSuggestions() {
  /**
   * Submit an edit suggestion for a listing
   */
  const suggestListingEdit = useCallback(async (listingId, changes, userId) => {
    try {
      const { data, error } = await supabase
        .from('edit_suggestions')
        .insert({
          listing_id: listingId,
          suggested_by: userId,
          changes: changes,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Failed to submit edit suggestion:', error);
      return { success: false, error };
    }
  }, []);

  /**
   * Approve an edit suggestion (Admin/Moderator only)
   */
  const approveSuggestion = useCallback(async (suggestionId, userId) => {
    try {
      // Get the suggestion details
      const { data: suggestion, error: fetchError } = await supabase
        .from('edit_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (fetchError) throw fetchError;

      // Apply the changes to the listing
      const { error: updateError } = await supabase
        .from('listings')
        .update(suggestion.changes)
        .eq('id', suggestion.listing_id);

      if (updateError) throw updateError;

      // Mark suggestion as approved
      const { error: statusError } = await supabase
        .from('edit_suggestions')
        .update({ status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq('id', suggestionId);

      if (statusError) throw statusError;

      return { success: true };
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
      return { success: false, error };
    }
  }, []);

  /**
   * Reject an edit suggestion (Admin/Moderator only)
   */
  const rejectSuggestion = useCallback(async (suggestionId, reason, userId) => {
    try {
      const { error } = await supabase
        .from('edit_suggestions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      return { success: false, error };
    }
  }, []);

  /**
   * Get pending edit suggestions (Admin/Moderator only)
   */
  const getPendingSuggestions = useCallback(async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('edit_suggestions')
        .select('*, listing:listings(id, name, name_mm), suggested_by_user:profiles(id, full_name, nickname)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Failed to fetch pending suggestions:', error);
      return { success: false, error };
    }
  }, []);

  return {
    suggestListingEdit,
    approveSuggestion,
    rejectSuggestion,
    getPendingSuggestions,
  };
}
