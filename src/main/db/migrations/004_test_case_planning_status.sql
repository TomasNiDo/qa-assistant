ALTER TABLE test_cases
ADD COLUMN planning_status TEXT NOT NULL DEFAULT 'drafted'
CHECK (planning_status IN ('drafted', 'approved'));

CREATE INDEX IF NOT EXISTS idx_test_cases_feature_planning_status
ON test_cases(feature_id, planning_status);
