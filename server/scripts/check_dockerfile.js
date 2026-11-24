'use strict';
const fs = require('fs');
const df = fs.readFileSync(__dirname + '/../Dockerfile', 'utf8');
const lines = df.split('\n');

const checks = [];

const userLine = lines.find(l => /^USER\s+\S/.test(l.trim()));
checks.push({ rule: 'USER directive present', pass: !!userLine, detail: userLine || 'MISSING' });
checks.push({ rule: 'USER is not root', pass: !!(userLine && !userLine.match(/USER\s+root/)), detail: userLine || '' });

const userIdx = lines.findIndex(l => /^USER\s+/.test(l.trim()));
const cmdIdx  = lines.findIndex(l => /^CMD\s+/.test(l.trim()));
checks.push({ rule: 'USER before CMD', pass: userIdx >= 0 && userIdx < cmdIdx, detail: 'USER@L' + (userIdx+1) + ' CMD@L' + (cmdIdx+1) });

checks.push({ rule: 'System group created (-S)', pass: df.includes('addgroup -S'), detail: '' });
checks.push({ rule: 'System user created (-S)', pass: df.includes('adduser -S'), detail: '' });

const recursiveAll = /chown\s+-R\s+quiro:quiro\s+\/app(\s|$)/.test(df);
checks.push({ rule: 'No recursive chown of entire /app', pass: !recursiveAll, detail: recursiveAll ? 'FOUND' : 'OK' });

checks.push({ rule: '/app itself chowned (non-recursive)', pass: /chown\s+quiro:quiro\s+\/app/.test(df), detail: 'Tesseract cache write' });
checks.push({ rule: 'public/uploads pre-created', pass: df.includes('/app/public/uploads'), detail: '' });
checks.push({ rule: 'uploads/invoices pre-created', pass: df.includes('/app/uploads/invoices'), detail: '' });
checks.push({ rule: 'chown -R on write dirs only', pass: /chown\s+-R\s+quiro:quiro\s+.*uploads/.test(df), detail: '' });
checks.push({ rule: 'HOME env set to /app', pass: df.includes('ENV HOME=/app'), detail: '' });
checks.push({ rule: 'EXPOSE 5000 preserved', pass: df.includes('EXPOSE 5000'), detail: '' });
checks.push({ rule: 'HEALTHCHECK preserved', pass: df.includes('HEALTHCHECK'), detail: '' });
checks.push({ rule: 'CMD node index.js preserved', pass: df.includes('node", "index.js"'), detail: '' });
checks.push({ rule: 'base stage present', pass: df.includes('AS base'), detail: '' });
checks.push({ rule: 'dependencies stage present', pass: df.includes('AS dependencies'), detail: '' });
checks.push({ rule: 'runner stage present', pass: df.includes('AS runner'), detail: '' });

const pass = checks.filter(c => c.pass).length;
const fail = checks.filter(c => !c.pass).length;
checks.forEach(c => {
    const icon = c.pass ? 'PASS' : 'FAIL';
    const detail = c.detail ? '  [' + c.detail + ']' : '';
    console.log(icon + '  ' + c.rule + detail);
});
console.log('');
console.log(pass + '/' + checks.length + ' checks passed' + (fail ? ' — ' + fail + ' FAILED' : '  ✓'));
process.exit(fail > 0 ? 1 : 0);
