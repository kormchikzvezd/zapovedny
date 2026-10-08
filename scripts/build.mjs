import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { rolldown } from 'rolldown';
import { validateHomes } from '../catalog/inventory.js';

const readJson = (file) =>
  JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

validateHomes(readJson(path.join(process.cwd(), 'catalog/homes.json')));

const cli = path.join(process.cwd(), 'node_modules/vinext/dist/cli.js');
const result = spawnSync(process.execPath, [cli, 'build'], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const publicImages = path.join(process.cwd(), 'public/images');
if (existsSync(publicImages)) {
  cpSync(publicImages, path.join(process.cwd(), 'dist/client/images'), { recursive: true });
}

const workerEntry = path.join(process.cwd(), 'dist/server/index.js');
copyFileSync(path.join(process.cwd(), 'worker/index.js'), workerEntry);
copyFileSync(path.join(process.cwd(), 'worker/leads.js'), path.join(process.cwd(), 'dist/server/leads.js'));
mkdirSync(path.join(process.cwd(), 'dist/catalog'), { recursive: true });
copyFileSync(path.join(process.cwd(), 'catalog/homes.json'), path.join(process.cwd(), 'dist/catalog/homes.json'));
copyFileSync(path.join(process.cwd(), 'catalog/inventory.js'), path.join(process.cwd(), 'dist/catalog/inventory.js'));

const bundle = await rolldown({
  input: workerEntry,
  external: (moduleId) => moduleId.startsWith('node:'),
  platform: 'node',
});

// Generate in memory first: writing onto the bundle input can leave the copied
// source entry in the archive when the output filename matches the input.
const { output } = await bundle.generate({ format: 'esm', inlineDynamicImports: true });
await bundle.close();
const chunks = output.filter((item) => item.type === 'chunk');
if (chunks.length !== 1 || chunks[0].imports.some((dependency) => !dependency.startsWith('node:'))) {
  throw new Error('The Site worker must be a single self-contained JavaScript bundle.');
}
writeFileSync(workerEntry, chunks[0].code);

console.log('Self-contained Sites worker entrypoint prepared: dist/server/index.js');
