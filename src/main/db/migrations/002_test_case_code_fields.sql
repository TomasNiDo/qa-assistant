ALTER TABLE test_cases ADD COLUMN generated_code TEXT NOT NULL DEFAULT '';
ALTER TABLE test_cases ADD COLUMN custom_code TEXT;
ALTER TABLE test_cases ADD COLUMN is_customized INTEGER NOT NULL DEFAULT 0;
