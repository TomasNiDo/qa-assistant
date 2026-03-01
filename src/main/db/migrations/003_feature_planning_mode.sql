PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,
  requirements TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_features_project_id ON features(project_id);

INSERT INTO features (id, project_id, title, acceptance_criteria, requirements, notes, created_at, updated_at)
SELECT lower(hex(randomblob(16))),
       projects.id,
       'Imported',
       'Imported legacy test cases',
       NULL,
       'Auto-created during feature planning migration',
       datetime('now'),
       datetime('now')
FROM projects
LEFT JOIN features imported_feature
  ON imported_feature.project_id = projects.id
 AND imported_feature.title = 'Imported'
WHERE imported_feature.id IS NULL;

DROP INDEX IF EXISTS idx_test_cases_project_id;
DROP INDEX IF EXISTS idx_steps_test_case_id;
DROP INDEX IF EXISTS idx_runs_test_case_id;
DROP INDEX IF EXISTS idx_step_results_run_id;

ALTER TABLE test_cases RENAME TO test_cases_legacy;
ALTER TABLE steps RENAME TO steps_legacy;
ALTER TABLE runs RENAME TO runs_legacy;
ALTER TABLE step_results RENAME TO step_results_legacy;

CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  title TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'positive' CHECK (test_type IN ('positive', 'negative', 'edge')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_ai_generated IN (0, 1)),
  generated_code TEXT NOT NULL DEFAULT '',
  custom_code TEXT,
  is_customized INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_feature_id ON test_cases(feature_id);

INSERT INTO test_cases (
  id,
  project_id,
  feature_id,
  title,
  test_type,
  priority,
  is_ai_generated,
  generated_code,
  custom_code,
  is_customized,
  created_at,
  updated_at
)
SELECT test_cases_legacy.id,
       test_cases_legacy.project_id,
       imported_feature.id,
       test_cases_legacy.title,
       'positive',
       'medium',
       0,
       COALESCE(test_cases_legacy.generated_code, ''),
       test_cases_legacy.custom_code,
       COALESCE(test_cases_legacy.is_customized, 0),
       test_cases_legacy.created_at,
       test_cases_legacy.updated_at
FROM test_cases_legacy
JOIN features imported_feature
  ON imported_feature.project_id = test_cases_legacy.project_id
 AND imported_feature.title = 'Imported';

CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  action_json TEXT NOT NULL,
  FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_test_case_id ON steps(test_case_id);

INSERT INTO steps (id, test_case_id, step_order, raw_text, action_json)
SELECT id, test_case_id, step_order, raw_text, action_json
FROM steps_legacy;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL,
  browser TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_test_case_id ON runs(test_case_id);

INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
SELECT id, test_case_id, browser, status, started_at, ended_at
FROM runs_legacy;

CREATE TABLE step_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL,
  error_text TEXT,
  screenshot_path TEXT,
  FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
  FOREIGN KEY(step_id) REFERENCES steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_results_run_id ON step_results(run_id);

INSERT INTO step_results (id, run_id, step_id, status, error_text, screenshot_path)
SELECT id, run_id, step_id, status, error_text, screenshot_path
FROM step_results_legacy;

DROP TABLE step_results_legacy;
DROP TABLE runs_legacy;
DROP TABLE steps_legacy;
DROP TABLE test_cases_legacy;

PRAGMA foreign_keys = ON;
