const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.join(
  process.cwd(),
  'components',
  'targets',
  'parseTargets.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
}).outputText;
const loadedModule = new Module(sourcePath, module);
loadedModule.filename = sourcePath;
loadedModule.paths = module.paths;
loadedModule._compile(compiled, sourcePath);
const { parseTargets } = loadedModule.exports;

const parsed = parseTargets(`
# authorised scope
192.0.2.10

example.test,Web portal,"Primary, external service"
192.0.2.10,Duplicate,ignored
not a target
999.999.1.1
`);

assert.equal(parsed.length, 4, 'blank lines, comments, and duplicates are skipped');
assert.deepEqual(
  parsed.slice(0, 2).map(({ target, valid }) => ({ target, valid })),
  [
    { target: '192.0.2.10', valid: true },
    { target: 'example.test', valid: true },
  ],
);
assert.equal(parsed[1].label, 'Web portal');
assert.equal(parsed[1].notes, 'Primary, external service');
assert.equal(parsed[2].valid, false);
assert.equal(parsed[3].valid, false);

console.log('bare IPv4 target: PASS');
console.log('CSV label and notes: PASS');
console.log('comments and blank lines skipped: PASS');
console.log('duplicate target removed: PASS');
console.log('invalid targets marked: PASS (2 invalid rows)');
