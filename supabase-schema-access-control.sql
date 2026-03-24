-- ============================================================
-- ACCESS CONTROL & EDIT SUGGESTIONS
-- ============================================================

-- Table for storing edit suggestions from users
CREATE TABLE IF NOT EXISTS edit_suggestions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  suggested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changes jsonb NOT NULL,  -- JSON object containing the proposed changes
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE edit_suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved suggestions
DROP POLICY IF EXISTS "Suggestions are viewable" ON edit_suggestions;
CREATE POLICY "Suggestions are viewable" ON edit_suggestions
  FOR SELECT USING (status = 'approved' OR auth.uid() = suggested_by);

-- Anyone can create suggestions
DROP POLICY IF EXISTS "Users can create suggestions" ON edit_suggestions;
CREATE POLICY "Users can create suggestions" ON edit_suggestions
  FOR INSERT WITH CHECK (auth.uid() = suggested_by);

-- Only admin/moderator can review suggestions
DROP POLICY IF EXISTS "Admin can review suggestions" ON edit_suggestions;
CREATE POLICY "Admin can review suggestions" ON edit_suggestions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE INDEX IF NOT EXISTS edit_suggestions_listing_idx ON edit_suggestions(listing_id);
CREATE INDEX IF NOT EXISTS edit_suggestions_status_idx ON edit_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS edit_suggestions_user_idx ON edit_suggestions(suggested_by);

-- ============================================================
-- UPDATE LISTINGS TABLE - ADD EDIT RESTRICTIONS
-- ============================================================

-- Add column to track who can edit directly (owner/admin only)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS allow_direct_edit boolean DEFAULT false;

-- Update RLS policies for listings to restrict direct edits
DROP POLICY IF EXISTS "Listings can be updated by owner or admin" ON listings;
CREATE POLICY "Listings can be updated by owner or admin" ON listings
  FOR UPDATE USING (
    auth.uid() = submitted_by OR
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  )
  WITH CHECK (
    auth.uid() = submitted_by OR
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- ============================================================
-- AUDIT LOG FOR ADMIN ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,  -- 'approve_listing', 'reject_listing', 'delete_listing', 'update_user_role', etc.
  target_table text,     -- 'listings', 'users', 'fuel_stations', etc.
  target_id uuid,
  changes jsonb,         -- What was changed
  reason text,           -- Why the action was taken
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
DROP POLICY IF EXISTS "Admin can view audit logs" ON admin_audit_log;
CREATE POLICY "Admin can view audit logs" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Only admin can create audit logs
DROP POLICY IF EXISTS "Admin can create audit logs" ON admin_audit_log;
CREATE POLICY "Admin can create audit logs" ON admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE INDEX IF NOT EXISTS audit_log_admin_idx ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON admin_audit_log(target_table, target_id);

-- ============================================================
-- FUNCTION TO LOG ADMIN ACTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id uuid,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_changes jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (admin_id, action, target_table, target_id, changes, reason)
  VALUES (p_admin_id, p_action, p_target_table, p_target_id, p_changes, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION TO AUTO-LOG LISTING APPROVAL
-- ============================================================

CREATE OR REPLACE FUNCTION log_listing_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    PERFORM log_admin_action(
      auth.uid(),
      'update_listing_status',
      'listings',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_listing_status_change ON listings;
CREATE TRIGGER on_listing_status_change
  AFTER UPDATE ON listings
  FOR EACH ROW EXECUTE PROCEDURE log_listing_approval();
