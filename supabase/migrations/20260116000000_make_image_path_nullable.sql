-- Make image_path nullable since we now use the photos array instead
ALTER TABLE items ALTER COLUMN image_path DROP NOT NULL;

-- Set a default empty string for image_path to avoid issues with existing code
ALTER TABLE items ALTER COLUMN image_path SET DEFAULT '';
