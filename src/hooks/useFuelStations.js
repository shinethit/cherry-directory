import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/errorHandler';

const FUEL_STATIONS_QUERY_KEY = 'fuelStations';
const FUEL_STATUS_QUERY_KEY = 'fuelStatus';

/**
 * Fetch all active fuel stations
 */
export const useFuelStations = () => {
  return useQuery({
    queryKey: [FUEL_STATIONS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_stations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    },
  });
};

/**
 * Fetch current fuel status for all stations
 */
export const useFuelStatus = () => {
  return useQuery({
    queryKey: [FUEL_STATUS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_fuel_status')
        .select('*')
        .order('station_id', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes for fuel status
  });
};

/**
 * Fetch fuel status for a specific station
 */
export const useFuelStatusByStation = (stationId) => {
  return useQuery({
    queryKey: [FUEL_STATUS_QUERY_KEY, stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_fuel_status')
        .select('*')
        .eq('station_id', stationId);

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!stationId,
    staleTime: 1000 * 60 * 2, // 2 minutes for fuel status
  });
};

/**
 * Report fuel availability
 */
export const useReportFuel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase
        .from('fuel_reports')
        .insert([data])
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'Report Fuel');
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FUEL_STATUS_QUERY_KEY] });
    },
  });
};

/**
 * Subscribe to real-time fuel status updates
 */
export const subscribeFuelUpdates = (callback) => {
  const subscription = supabase
    .channel('fuel_reports')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'fuel_reports',
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return subscription;
};
