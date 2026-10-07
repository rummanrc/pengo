// Run the existing real-code course drivers without the optional dukpy dependency.
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const drivers = execFileSync('python3', ['-c',
  "import runpy; t=runpy.run_path('tests/test_course.py'); print(t['DRIVER'] + t['DRIVER2'])"], { cwd: root, encoding: 'utf8' });
const result = JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(root, 'course.js'), 'utf8') + drivers));
console.log('Course:', result.passed, 'passed;', result.failures.length, 'failed');
if (result.failures.length) { console.error(result.failures); process.exitCode = 1; }
