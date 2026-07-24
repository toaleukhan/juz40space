// CI/локальді тексеру: src/ ішіндегі әр .js файлдың синтаксисі дұрыс па —
// нақты серверді іске қоспай-ақ тексереді (node --check).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', 'src');

function collectJsFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(collectJsFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = collectJsFiles(ROOT);
let failed = false;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`OK   ${path.relative(process.cwd(), file)}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${path.relative(process.cwd(), file)}`);
    console.error(err.stderr?.toString() || err.message);
  }
}

if (failed) {
  console.error(`\n${files.length} файлдың ішінен қате бар.`);
  process.exit(1);
}
console.log(`\n✔ Барлық ${files.length} backend файл синтаксисі дұрыс.`);
