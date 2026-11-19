import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'pages-dist');
await mkdir(output,{recursive:true});
for(const file of ['index.html','styles.css','app.js']) await copyFile(resolve(root,file),resolve(output,file));
await writeFile(resolve(output,'.nojekyll'),'','utf8');
