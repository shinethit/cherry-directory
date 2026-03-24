import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';

const LISTINGS_QUERY_KEY = 'listings';
const PAGE_SIZE = 20;

/**
 * Fetch listings with pagination and filtering
 */
export const useListings = (filters = {}, page = 1) => {
  return useQuery({
    queryKey: [LISTINGS_QUERY_KEY, filters, page],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .eq('status', 'approved');

      // Apply filters
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters.city) {
        query = query.eq('city', filters.city);
      }

      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        listings: data,
        total: count,
        hasMore: count > page * PAGE_SIZE,
      };
    },
  });
};

/**
 * Fetch single listing
 */
export const useListing = (id) => {
  return useQuery({
    queryKey: [LISTINGS_QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
};

/**
 * Create or update listing
 */
export const useCreateListing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase
        .from('listings')
        .insert([data])
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Create Listing');
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LISTINGS_QUERY_KEY] });
    },
  });
};

/**
 * Update listing
 */
export const useUpdateListing = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase
        .from('listings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Update Listing');
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LISTINGS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LISTINGS_QUERY_KEY, id] });
    },
  });
};

/**
 * Delete listing
 */
export const useDeleteListing = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);

      if (error) {
        handleSupabaseError(error, 'Delete Listing');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LISTINGS_QUERY_KEY] });
    },
  });
};
