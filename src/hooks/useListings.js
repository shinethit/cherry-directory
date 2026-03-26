import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';

const LISTINGS_QUERY_KEY = 'listings';
const PAGE_SIZE = 20;

/**
 * Fetch listings with pagination and filtering
 * Optimized for Myanmar users
 */
export const useListings = (filters = {}, page = 1) => {
  return useQuery({
    queryKey: [LISTINGS_QUERY_KEY, filters, page],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select(`
          id,
          name,
          name_mm,
          description,
          description_mm,
          address,
          address_mm,
          city,
          township,
          ward,
          phone_1,
          phone_2,
          viber,
          telegram,
          whatsapp,
          facebook,
          website,
          logo_url,
          cover_url,
          images,
          latitude,
          longitude,
          rating_avg,
          rating_count,
          is_verified,
          is_featured,
          business_type,
          status,
          category:categories(id, name, name_mm, icon),
          created_at
        `, { count: 'exact' })
        .eq('status', 'approved');

      // Apply filters
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters.city && filters.city !== 'All') {
        query = query.eq('city', filters.city);
      }
      if (filters.verifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,name_mm.ilike.%${filters.search}%`);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Order by rating_avg (for directory) or created_at (for others)
      let orderQuery = query;
      if (filters.orderBy === 'rating') {
        orderQuery = query.order('rating_avg', { ascending: false, nullsFirst: false });
      } else {
        orderQuery = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await orderQuery
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        listings: data || [],
        total: count || 0,
        hasMore: (count || 0) > page * PAGE_SIZE,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - reduce API calls
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/**
 * Fetch single listing with full details
 */
export const useListing = (id) => {
  return useQuery({
    queryKey: [LISTINGS_QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          category:categories(id, name, name_mm, icon),
          owner:profiles!owner_id(id, full_name, avatar_url),
          submitter:profiles!submitted_by(id, full_name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Fetch categories with caching
 */
export const useCategories = (type = 'directory') => {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
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