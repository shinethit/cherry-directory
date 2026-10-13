import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { startRun, recordItem, finishRun, failRun } from '../lib/cacheStatus'

/**
 * Pre-fetch all critical data on app start so it's available offline.
 * Runs once per session (uses ref to prevent duplicates).
 * Errors are silent (network might be down on first load).
 */
export function usePrefetchAll() {
  const queryClient = useQueryClient()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    async function prefetch() {
      // Skip if already online? No — we want to refresh cache anyway
      const onlyWhenOnline = navigator.onLine
      if (!onlyWhenOnline) {
        console.log('[Prefetch] Offline — skipping prefetch')
        return
      }

      console.log('[Prefetch] Starting...')
      const t0 = Date.now()

      const tasks = [
        // label for UI tracking
        // 1. Top-level categories
        {
          key: ['prefetch', 'categories'],
          label: 'Categories',
          fn: () => supabase
            .from('categories')
            .select('*')
            .eq('type', 'directory')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },

        // 2. Approved listings (first 100)
        {
          key: ['prefetch', 'listings'],
          label: 'Listings',
          fn: () => supabase
            .from('listings')
            .select('*, category:categories(name, name_mm, icon)')
            .eq('status', 'approved')
            .order('rating_avg', { ascending: false, nullsFirst: false })
            .limit(100)
            .then(r => r.data || []),
        },

        // 3. Published posts (first 30)
        {
          key: ['prefetch', 'posts'],
          label: 'News & Posts',
          fn: () => supabase
            .from('posts')
            .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 4. Emergency contacts
        {
          key: ['prefetch', 'emergency'],
          label: 'Emergency',
          fn: () => supabase
            .from('emergency_contacts')
            .select('*')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },

        // 5. Power areas + status
        {
          key: ['prefetch', 'power-areas'],
          label: 'Power Areas',
          fn: () => supabase
            .from('power_areas')
            .select('*')
            .order('sort_order')
            .then(r => r.data || []),
        },
        {
          key: ['prefetch', 'power-status'],
          label: 'Power Status',
          fn: () => supabase
            .from('current_power_status')
            .select('*')
            .then(r => r.data || []),
        },

        // 6. Fuel stations + types
        {
          key: ['prefetch', 'fuel-stations'],
          label: 'Fuel Stations',
          fn: () => supabase
            .from('fuel_stations')
            .select('*')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },
        {
          key: ['prefetch', 'fuel-types'],
          label: 'Fuel Types',
          fn: () => supabase
            .from('fuel_types')
            .select('*')
            .order('sort_order')
            .then(r => r.data || []),
        },

        // 7. Markets
        {
          key: ['prefetch', 'markets'],
          label: 'Markets',
          fn: () => supabase
            .from('markets')
            .select('*')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },

        // 8. Price items
        {
          key: ['prefetch', 'price-items'],
          label: 'Price Items',
          fn: () => supabase
            .from('price_items')
            .select('*')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },
        {
          key: ['prefetch', 'current-prices'],
          label: 'Current Prices',
          fn: () => supabase
            .from('current_prices')
            .select('*')
            .then(r => r.data || []),
        },

        // 9. Weather alerts
        {
          key: ['prefetch', 'weather'],
          label: 'Weather',
          fn: () => supabase
            .from('weather_alerts')
            .select('*')
            .eq('status', 'active')
            .order('posted_at', { ascending: false })
            .limit(20)
            .then(r => r.data || []),
        },

        // 10. Notices (approved)
        {
          key: ['prefetch', 'notices'],
          label: 'Notices',
          fn: () => supabase
            .from('notices')
            .select('*')
            .eq('status', 'approved')
            .order('posted_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 11. Jobs
        {
          key: ['prefetch', 'jobs'],
          label: 'Jobs',
          fn: () => supabase
            .from('jobs')
            .select('*')
            .order('posted_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 12. Rentals
        {
          key: ['prefetch', 'rentals'],
          label: 'Rentals',
          fn: () => supabase
            .from('rentals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 13. Tutoring
        {
          key: ['prefetch', 'tutoring'],
          label: 'Tutoring',
          fn: () => supabase
            .from('tutoring')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 14. Lost & Found
        {
          key: ['prefetch', 'lost-found'],
          label: 'Lost & Found',
          fn: () => supabase
            .from('lost_found')
            .select('*')
            .eq('status', 'active')
            .order('reported_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 15. Health services
        {
          key: ['prefetch', 'health'],
          label: 'Health',
          fn: () => supabase
            .from('health_services')
            .select('*')
            .eq('status', 'active')
            .order('posted_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 16. Bus schedules
        {
          key: ['prefetch', 'bus-schedules'],
          label: 'Bus Schedules',
          fn: () => supabase
            .from('bus_departures')
            .select('*')
            .order('departure_time', { ascending: true })
            .limit(50)
            .then(r => r.data || []),
        },

        // 17. Tours
        {
          key: ['prefetch', 'tours'],
          label: 'Tours',
          fn: () => supabase
            .from('tour_guides')
            .select('*')
            .eq('is_active', true)
            .limit(30)
            .then(r => r.data || []),
        },

        // 18. History
        {
          key: ['prefetch', 'history'],
          label: 'History',
          fn: () => supabase
            .from('history')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(30)
            .then(r => r.data || []),
        },

        // 19. Donations
        {
          key: ['prefetch', 'donations'],
          label: 'Donations',
          fn: () => supabase
            .from('donations')
            .select('*')
            .eq('status', 'active')
            .limit(20)
            .then(r => r.data || []),
        },

        // 20. Chat rooms
        {
          key: ['prefetch', 'chat-rooms'],
          label: 'Chat Rooms',
          fn: () => supabase
            .from('chat_rooms')
            .select('*')
            .eq('is_active', true)
            .order('sort_order')
            .then(r => r.data || []),
        },
      ]

      // Notify start
      startRun(tasks.length)

      // Run all in parallel, silently ignore failures
      const results = await Promise.allSettled(
        tasks.map(async ({ key, fn, label }) => {
          try {
            const data = await fn()
            queryClient.setQueryData(key, data)
            const item = { key: key.join('/'), label: label || key[1], count: data.length, status: 'ok' }
            recordItem(item)
            return { key, count: data.length }
          } catch (e) {
            const item = { key: key.join('/'), label: label || key[1], count: 0, status: 'error', error: e.message }
            recordItem(item)
            return { key, error: e.message }
          }
        })
      )

      const ok = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length
      const failed = tasks.length - ok
      const elapsed = Date.now() - t0

      console.log(`[Prefetch] Done: ${ok}/${tasks.length} ok, ${failed} failed (${elapsed}ms)`)
      finishRun()
    }

    // Slight delay so app renders first
    const t = setTimeout(() => {
      prefetch().catch(err => {
        console.error('[Prefetch] Failed:', err)
        failRun(err)
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [queryClient])
}
