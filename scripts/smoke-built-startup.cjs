const { mkdtempSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const electronBinary = require('electron');

function runSmoke() {
  const projectRoot = resolve(__dirname, '..');
  const entrypoint = join(projectRoot, 'out', 'main', 'index.js');
  const tempRoot = mkdtempSync(join(tmpdir(), 'qa-assistant-smoke-'));
  const dataRoot = join(tempRoot, 'qa-assistant-data');
  const dbFile = join(dataRoot, 'db.sqlite');

  const env = {
    ...process.env,
    QA_ASSISTANT_SMOKE_STARTUP: '1',
    QA_ASSISTANT_DATA_ROOT: dataRoot,
  };

  try {
    const result = spawnSync(electronBinary, [entrypoint], {
      cwd: projectRoot,
      env,
      stdio: 'pipe',
      timeout: 60_000,
      encoding: 'utf8',
    });

    if (result.error) {
      throw result.error;
    }

    if (typeof result.status !== 'number' || result.status !== 0) {
      throw new Error(
        [`Smoke startup failed with status ${result.status}.`, result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (!existsSync(dbFile)) {
      throw new Error(`Smoke startup did not create DB file: ${dbFile}`);
    }

    console.log(`[smoke] Built startup smoke passed. Data root: ${dataRoot}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

runSmoke();
