import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = (nome) => path.join(raiz, 'node_modules', '.bin', nome);

const api = spawn(bin('tsx'), ['src/server.ts'], { cwd: raiz, stdio: 'inherit' });
const web = spawn(bin('vite'), { cwd: path.join(raiz, 'web'), stdio: 'inherit' });

let encerrado = false;

function encerrar(codigo = 0) {
  if (encerrado) return;
  encerrado = true;
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  process.exit(codigo);
}

api.on('exit', (codigo) => {
  if (!encerrado) encerrar(codigo ?? 1);
});

web.on('exit', (codigo) => {
  if (!encerrado) encerrar(codigo ?? 1);
});

process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));
