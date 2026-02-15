const { copyFileSync, existsSync, mkdirSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const sourceDir = join(projectRoot, 'src', 'main', 'db', 'migrations');
const destinationDir = join(projectRoot, 'out', 'main', 'db', 'migrations');

if (!existsSync(sourceDir)) {
  throw new Error(`Missing source migrations directory: ${sourceDir}`);
}

mkdirSync(destinationDir, { recursive: true });

const files = readdirSync(sourceDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No migration files found in: ${sourceDir}`);
}

for (const fileName of files) {
  const source = join(sourceDir, fileName);
  const destination = join(destinationDir, fileName);
  copyFileSync(source, destination);
}

console.log(`[build:copy-migrations] Copied ${files.length} migration file(s) to ${destinationDir}`);
