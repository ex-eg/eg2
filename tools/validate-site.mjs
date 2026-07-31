import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const failures = [];

for (const file of readdirSync(assets).filter(name => name.endsWith('.js'))) {
  const fullPath = join(assets, file);
  try {
    execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
  } catch (error) {
    failures.push(`${file}: JavaScript syntax check failed\n${error.stderr?.toString() || error.message}`);
  }
}

for (const file of readdirSync(root).filter(name => name.endsWith('.html'))) {
  const html = readFileSync(join(root, file), 'utf8');
  for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
    const asset = match[1];
    if (/^(?:https?:|\/\/|data:|#)/i.test(asset)) continue;
    const target = resolve(dirname(join(root, file)), asset);
    if (!existsSync(target)) failures.push(`${file}: missing referenced file ${asset}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exitCode = 1;
} else {
  console.log(`Site validation passed: ${readdirSync(assets).filter(name => name.endsWith('.js')).length} JS files checked.`);
}
