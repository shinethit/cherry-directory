-- Rentals table (အိမ်ရှင် - အိမ်ငှား)
CREATE TABLE IF NOT EXISTS rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  title_mm TEXT,
  description_mm TEXT,
  location_mm TEXT,
  property_type TEXT DEFAULT 'room', -- room, apartment, house, land, shop
  post_type TEXT DEFAULT 'owner', -- owner, tenant
  price_monthly INTEGER,
  price_deposit INTEGER,
  phone TEXT,
  contact_name TEXT,
  images TEXT[],
  is_urgent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available', -- available, pending, rented
  user_id UUID REFERENCES profiles(id),
  poster_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view rentals" ON rentals
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rentals" ON rentals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own rentals" ON rentals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rentals" ON rentals
  FOR DELETE USING (auth.uid() = user_id);

-- Tutoring table (ဆရာ - ကျောင်းသား)
CREATE TABLE IF NOT EXISTS tutoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  title_mm TEXT,
  description_mm TEXT,
  location_mm TEXT,
  subject TEXT DEFAULT 'math',
  grade_level TEXT DEFAULT 'high',
  post_type TEXT DEFAULT 'tutor', -- tutor, student
  price_hourly INTEGER,
  price_monthly INTEGER,
  phone TEXT,
  contact_name TEXT,
  availability_schedule TEXT,
  images TEXT[],
  is_urgent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available', -- available, pending, booked, unavailable
  user_id UUID REFERENCES profiles(id),
  poster_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tutoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tutoring" ON tutoring
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert tutoring" ON tutoring
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own tutoring" ON tutoring
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tutoring" ON tutoring
  FOR DELETE USING (auth.uid() = user_id);

-- History table (ဒေသဆိုင်ရာ သမိုင်းကြောင်း)
CREATE TABLE IF NOT EXISTS history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  title_mm TEXT,
  excerpt_mm TEXT,
  content_mm TEXT,
  category TEXT DEFAULT 'history',
  location_mm TEXT,
  event_date DATE,
  cover_url TEXT,
  images TEXT[],
  author_id UUID REFERENCES profiles(id),
  author_name TEXT,
  author_bio TEXT,
  status TEXT DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view history" ON history
  FOR SELECT USING (status = 'published');
CREATE POLICY "Moderators can insert history" ON history
  FOR INSERT WITH CHECK (auth.role() IN ('moderator', 'admin'));
CREATE POLICY "Moderators can update history" ON history
  FOR UPDATE USING (auth.role() IN ('moderator', 'admin'));
CREATE POLICY "Moderators can delete history" ON history
  FOR DELETE USING (auth.role() IN ('moderator', 'admin'));

-- Update jobs table to add post_type and status columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'employer';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE rentals, tutoring, history;

-- Update existing jobs to have post_type
UPDATE jobs SET post_type = 'employer' WHERE post_type IS NULL;
UPDATE jobs SET status = 'available' WHERE status IS NULL;
