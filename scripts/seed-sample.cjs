/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console */

const { app } = require('electron');
const Database = require('better-sqlite3');
const { existsSync, mkdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');

const SAMPLE_PROJECT = {
  name: 'Sample QA Project',
  baseUrl: 'https://example.com',
  envLabel: 'sample',
  metadata: {
    seedTag: 'sample-local',
  },
};

const SAMPLE_TEST = {
  title: 'Sample login flow',
  steps: [
    {
      rawText: 'Enter "qa.user@example.com" in "Email" field',
      actionJson: {
        type: 'enter',
        target: 'Email',
        value: 'qa.user@example.com',
      },
    },
    {
      rawText: 'Enter "password123" in "Password" field',
      actionJson: {
        type: 'enter',
        target: 'Password',
        value: 'password123',
      },
    },
    {
      rawText: 'Click "Login"',
      actionJson: {
        type: 'click',
        target: 'Login',
      },
    },
    {
      rawText: 'Expect dashboard is visible',
      actionJson: {
        type: 'expect',
        assertion: 'dashboard is visible',
      },
    },
  ],
};

function nowIso() {
  return new Date().toISOString();
}

function seedDatabase(db) {
  const migrationFile = join(process.cwd(), 'src', 'main', 'db', 'migrations', '001_initial.sql');
  if (!existsSync(migrationFile)) {
    throw new Error(`Missing migration file: ${migrationFile}`);
  }

  db.exec(readFileSync(migrationFile, 'utf8'));

  const existingProject = db
    .prepare(
      'SELECT id, name, base_url, env_label FROM projects WHERE name = ? AND base_url = ? AND env_label = ? LIMIT 1',
    )
    .get(SAMPLE_PROJECT.name, SAMPLE_PROJECT.baseUrl, SAMPLE_PROJECT.envLabel);

  let projectId;
  let createdProject = false;
  if (existingProject) {
    projectId = existingProject.id;
  } else {
    projectId = randomUUID();
    createdProject = true;
    db.prepare(
      `INSERT INTO projects (id, name, base_url, env_label, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      projectId,
      SAMPLE_PROJECT.name,
      SAMPLE_PROJECT.baseUrl,
      SAMPLE_PROJECT.envLabel,
      JSON.stringify(SAMPLE_PROJECT.metadata),
      nowIso(),
    );
  }

  const existingTest = db
    .prepare('SELECT id FROM test_cases WHERE project_id = ? AND title = ? LIMIT 1')
    .get(projectId, SAMPLE_TEST.title);

  let testCaseId;
  let createdTestCase = false;
  if (existingTest) {
    testCaseId = existingTest.id;
  } else {
    testCaseId = randomUUID();
    createdTestCase = true;
    const timestamp = nowIso();

    db.prepare(
      `INSERT INTO test_cases (id, project_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(testCaseId, projectId, SAMPLE_TEST.title, timestamp, timestamp);

    const insertStep = db.prepare(
      `INSERT INTO steps (id, test_case_id, step_order, raw_text, action_json)
       VALUES (?, ?, ?, ?, ?)`,
    );

    SAMPLE_TEST.steps.forEach((step, index) => {
      insertStep.run(
        randomUUID(),
        testCaseId,
        index + 1,
        step.rawText,
        JSON.stringify(step.actionJson),
      );
    });
  }

  return { projectId, testCaseId, createdProject, createdTestCase };
}

app
  .whenReady()
  .then(() => {
    const root = join(app.getPath('userData'), 'qa-assistant');
    mkdirSync(root, { recursive: true });

    const dbPath = join(root, 'db.sqlite');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    try {
      const result = seedDatabase(db);
      console.log(
        `[seed:sample] Done. project=${result.projectId} testCase=${result.testCaseId} createdProject=${result.createdProject} createdTestCase=${result.createdTestCase}`,
      );
    } finally {
      db.close();
      app.quit();
    }
  })
  .catch((error) => {
    console.error('[seed:sample] Failed:', error);
    app.exit(1);
  });
