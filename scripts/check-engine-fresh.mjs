/* Fail when the scripts in js/ are older than the TypeScript engine.
   The page loads those scripts directly, so a forgotten rebuild would ship old save/sync code. */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const configFile = ts.readConfigFile('tsconfig.engine.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
const outDir = mkdtempSync(join(tmpdir(), 'operate-engine-'));
const options = { ...parsed.options, noEmit: false, outDir, noEmitOnError: true };
const program = ts.createProgram(parsed.fileNames, options);
const emitted = program.emit();
if (emitted.emitSkipped) {
  console.error('Engine type check failed, so the scripts were not compared.');
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

let stale = 0;
for (const name of readdirSync(outDir)) {
  if (!name.endsWith('.js')) continue;
  const fresh = readFileSync(join(outDir, name), 'utf8').replace(/\r\n/g, '\n');
  const committed = readFileSync(join('js', name), 'utf8').replace(/\r\n/g, '\n');
  if (fresh !== committed) {
    stale++;
    console.error('Out of date: js/' + name + ' — run npm run build:engine and include that file.');
  }
}
rmSync(outDir, { recursive: true, force: true });
if (stale) process.exit(1);
console.log('Engine scripts match the TypeScript source.');
