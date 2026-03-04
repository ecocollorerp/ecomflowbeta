import { execSync } from 'node:child_process';

const PORTS = [3000, 24678];

function run(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch {
    return '';
  }
}

function killWindowsPort(port) {
  const output = run(`netstat -ano -p tcp | findstr :${port}`);
  if (!output.trim()) {
    return;
  }

  const pids = new Set();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('LISTENING')) continue;
    const parts = trimmed.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[predev] Porta ${port}: processo ${pid} encerrado`);
    } catch {
      console.log(`[predev] Porta ${port}: não foi possível encerrar o processo ${pid}`);
    }
  }
}

function killUnixPort(port) {
  const output = run(`lsof -ti tcp:${port}`);
  if (!output.trim()) return;

  const pids = output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const pid of pids) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[predev] Porta ${port}: processo ${pid} encerrado`);
    } catch {
      console.log(`[predev] Porta ${port}: não foi possível encerrar o processo ${pid}`);
    }
  }
}

for (const port of PORTS) {
  if (process.platform === 'win32') {
    killWindowsPort(port);
  } else {
    killUnixPort(port);
  }
}
