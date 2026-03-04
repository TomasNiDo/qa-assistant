const { execFileSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'win32') {
  process.exit(0);
}

const projectElectronExe = path.join(
  process.cwd(),
  'node_modules',
  'electron',
  'dist',
  'electron.exe'
);

const escapedProjectElectronExe = projectElectronExe
  .replace(/'/g, "''")
  .replace(/\\/g, '\\\\');

const psScript = `
$target = '${escapedProjectElectronExe}'
$matches = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -ieq 'electron.exe' -and $_.ExecutablePath -ieq $target }

foreach ($proc in $matches) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped project Electron process (PID: $($proc.ProcessId))"
}
`;

execFileSync(
  'powershell',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
  { stdio: 'inherit' }
);
