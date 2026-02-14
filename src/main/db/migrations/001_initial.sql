CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  env_label TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  action_json TEXT NOT NULL,
  FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_test_case_id ON steps(test_case_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL,
  browser TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_test_case_id ON runs(test_case_id);

CREATE TABLE IF NOT EXISTS step_results (
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
