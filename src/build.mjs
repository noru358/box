// dist/index.html 하나로 합친다.
// - 규칙(브라우저·node 공용): src/engine.js, src/ai.js → game.html의 /*ENGINE*/ 자리
// - 화면: src/view/*.js를 VIEW 순서대로 이어 붙여 → /*VIEW*/ 자리(한 함수 안이라 서로의 이름을 그대로 씀)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
const RULES = ['src/engine.js', 'src/ai.js'];
// 순서가 중요하다: 앞 파일이 만든 이름을 뒤 파일이 시작하자마자 쓴다
const VIEW = ['scene', 'tiles', 'boxes', 'flow', 'input', 'record', 'hunter', 'net', 'loop'].map(n => `src/view/${n}.js`);
const page = read('src/game.html');
for (const k of ['/*ENGINE*/', '/*VIEW*/']) if (!page.includes(k)) throw new Error(`src/game.html에 ${k} 자리가 없어요`);
const join2 = fs => fs.filter(f => existsSync(join(root, f))).map(f => `// ===== ${f} =====\n` + read(f)).join('\n');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), page.replace('/*ENGINE*/', () => join2(RULES)).replace('/*VIEW*/', () => join2(VIEW)));
console.log('dist/index.html 만듦');
