// 엔진(src/engine.js)을 화면(src/game.html)의 /*ENGINE*/ 자리에 넣어 dist/index.html 하나로 만든다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = readFileSync(join(root, 'src/engine.js'), 'utf8');
const page = readFileSync(join(root, 'src/game.html'), 'utf8');
if (!page.includes('/*ENGINE*/')) throw new Error('src/game.html에 /*ENGINE*/ 자리가 없어요');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), page.replace('/*ENGINE*/', () => engine));
console.log('dist/index.html 만듦');
