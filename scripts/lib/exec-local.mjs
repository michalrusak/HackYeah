import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function resolveLocalBin(command, cwd) {
  let dir = cwd;

  while (true) {
    const binDir = path.join(dir, 'node_modules', '.bin');

    if (process.platform === 'win32') {
      const cmd = path.join(binDir, `${command}.cmd`);
      const exe = path.join(binDir, `${command}.exe`);
      if (existsSync(cmd)) return cmd;
      if (existsSync(exe)) return exe;
    }

    const unixBin = path.join(binDir, command);
    if (existsSync(unixBin)) return unixBin;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return command;
}

export function execLocal(command, args, options = {}) {
  const { cwd = process.cwd(), env } = options;
  const bin = resolveLocalBin(command, cwd);
  const runtimeEnv = env ? { ...process.env, ...env } : process.env;
  const spawnOptions = { stdio: 'inherit', cwd, env: runtimeEnv };

  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    return spawn('cmd.exe', ['/d', '/s', '/c', bin, ...args], spawnOptions);
  }

  return spawn(bin, args, spawnOptions);
}

export function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve(code ?? 0);
        return;
      }

      reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}
