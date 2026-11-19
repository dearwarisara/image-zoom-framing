import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const css = await readFile(resolve(root, 'styles.css'), 'utf8');
const js = await readFile(resolve(root, 'app.js'), 'utf8');
const source = await readFile(resolve(root, 'worker/index.js'), 'utf8');
const inlineHtml = html
  .replace(/\s*<link rel="stylesheet" href="\/styles\.css"\s*\/>/, `\n  <style>\n${css}\n  </style>`)
  .replace(/\s*<script src="\/app\.js" defer><\/script>/, `\n  <script>\n${js}\n  </script>`);
if (inlineHtml === html) throw new Error('Could not embed the page assets into the worker.');
const bundled = source.replace('"__FRAME_HTML_JSON__"', JSON.stringify(inlineHtml));
if (bundled === source) throw new Error('Could not inject the bundled page into the worker.');
const output = resolve(root, 'dist/server/index.js');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bundled, 'utf8');
const hostingOutput = resolve(root, 'dist/.openai/hosting.json');
await mkdir(dirname(hostingOutput), { recursive: true });
await copyFile(resolve(root, '.openai/hosting.json'), hostingOutput);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`;
const worker = await import(moduleUrl);
if (typeof worker.default?.fetch !== 'function') throw new Error('The Worker output must export default.fetch.');
