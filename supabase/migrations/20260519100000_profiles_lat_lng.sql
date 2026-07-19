ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat numeric(9, 6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng numeric(9, 6);
