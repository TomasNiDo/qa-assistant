const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

let testExitCode = 0;

const rebuildNodeExitCode = run('npm', ['rebuild', 'better-sqlite3']);
if (rebuildNodeExitCode !== 0) {
  testExitCode = rebuildNodeExitCode;
}

if (testExitCode === 0) {
  testExitCode = run('npm', ['run', 'test:vitest']);
}

const restoreElectronExitCode = run('npm', ['run', 'rebuild:native']);
if (testExitCode === 0 && restoreElectronExitCode !== 0) {
  testExitCode = restoreElectronExitCode;
}

process.exit(testExitCode);
