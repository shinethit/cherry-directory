-- Fix for ERROR: 42P16: cannot drop columns from view
-- This script should be run in Supabase SQL Editor if you encounter the error.

-- 1. Drop the dependent view first
DROP VIEW IF EXISTS current_fuel_status;

-- 2. Add new columns to fuel_stations table if they don't exist
ALTER TABLE fuel_stations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE fuel_stations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fuel_stations ADD COLUMN IF NOT EXISTS operating_hours JSONB;

-- 3. Recreate the view with updated schema
CREATE OR REPLACE VIEW current_fuel_status AS
WITH latest AS (
  SELECT DISTINCT ON (station_id, fuel_type)
    station_id, fuel_type, status, queue_level, price, notes, reported_at
  FROM fuel_reports
  WHERE reported_at > NOW() - INTERVAL '6 hours'
  ORDER BY station_id, fuel_type, reported_at DESC
)
SELECT
  fs.id AS station_id, fs.name, fs.name_mm, fs.township, fs.address, fs.phone, fs.notes AS station_notes, fs.operating_hours,
  ft.id AS fuel_id, ft.name AS fuel_name, ft.name_mm AS fuel_name_mm, ft.icon,
  COALESCE(l.status, 'unknown') AS status,
  l.queue_level, l.price, l.notes, l.reported_at
FROM fuel_stations fs
CROSS JOIN fuel_types ft
LEFT JOIN latest l ON l.station_id = fs.id AND l.fuel_type = ft.id
WHERE fs.is_active = TRUE
ORDER BY fs.sort_order, ft.id;

-- Optional: Add RLS policies for notifications table if not already present
-- This was added in the previous implementation phase but might be missing if schema was not fully applied
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (TRUE);
