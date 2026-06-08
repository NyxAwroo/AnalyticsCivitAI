import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const fr = JSON.parse(await readFile(resolve(root, 'src/i18n/fr.json'), 'utf8'));
const en = JSON.parse(await readFile(resolve(root, 'src/i18n/en.json'), 'utf8'));

const frKeys = Object.keys(fr).sort();
const enKeys = new Set(Object.keys(en));
const missing = frKeys.filter((key) => !enKeys.has(key));

if (missing.length > 0) {
  console.error(`en.json is missing ${missing.length} i18n key(s):`);
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log(`i18n parity OK: ${frKeys.length} keys.`);
