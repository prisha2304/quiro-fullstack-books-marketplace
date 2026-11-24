/**
 * QUIRO — Step 8B Task 3: Nginx Configuration Static Analysis Tests
 *
 * Verifies nginx/nginx.conf:
 * 1. /socket.io/ location has X-Real-IP, X-Forwarded-For, X-Forwarded-Proto headers.
 * 2. /socket.io/ retains WebSocket Upgrade and Connection headers.
 * 3. /api/ location retains all forwarded headers.
 * 4. SPA fallback (try_files) in / location is intact.
 * 5. /api/ proxy_pass points to backend:5000.
 * 6. /socket.io/ proxy_pass points to backend:5000.
 * 7. No unrelated routes were changed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

async function runNginxConfigTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 8B Task 3: Nginx Socket.IO Header Static Analysis');
    console.log('============================================================\n');

    let pass = 0;
    let total = 0;
    const failures = [];

    function check(desc, condition) {
        total++;
        if (condition) {
            pass++;
            console.log(`  [PASS] ${total}: ${desc}`);
        } else {
            console.error(`  [FAIL] ${total}: ${desc}`);
            failures.push(desc);
        }
    }

    const nginxConfPath = path.join(__dirname, '../../../nginx/nginx.conf');
    check('nginx/nginx.conf file exists', fs.existsSync(nginxConfPath));

    const conf = fs.readFileSync(nginxConfPath, 'utf8');

    // Extract the /socket.io/ block
    const socketBlock = conf.match(/location\s+\/socket\.io\/\s*\{([^}]+)\}/s);
    check('/socket.io/ location block is present', !!socketBlock);
    const sb = socketBlock ? socketBlock[1] : '';

    // ── Socket.IO forwarded headers (the fix) ────────────────────────────────
    check('/socket.io/: X-Real-IP header present', sb.includes('X-Real-IP'));
    check('/socket.io/: X-Forwarded-For header present', sb.includes('X-Forwarded-For'));
    check('/socket.io/: X-Forwarded-Proto header present', sb.includes('X-Forwarded-Proto'));

    // ── Socket.IO WebSocket upgrade headers (preserved) ──────────────────────
    check('/socket.io/: Upgrade header present (WebSocket upgrade)', sb.includes('Upgrade'));
    check('/socket.io/: Connection header present (upgrade)', sb.includes('Connection'));
    check('/socket.io/: proxy_http_version 1.1 set', sb.includes('proxy_http_version 1.1'));
    check('/socket.io/: proxy_pass to backend:5000/socket.io/', sb.includes('proxy_pass http://backend:5000/socket.io/'));
    check('/socket.io/: proxy_cache_bypass set', sb.includes('proxy_cache_bypass'));
    check('/socket.io/: Host header forwarded', sb.includes('$host'));

    // ── API location block integrity ─────────────────────────────────────────
    console.log('\n--- /api/ location integrity ---');
    const apiBlock = conf.match(/location\s+\/api\/\s*\{([^}]+)\}/s);
    check('/api/ location block is present', !!apiBlock);
    const ab = apiBlock ? apiBlock[1] : '';

    check('/api/: X-Real-IP header present', ab.includes('X-Real-IP'));
    check('/api/: X-Forwarded-For header present', ab.includes('X-Forwarded-For'));
    check('/api/: X-Forwarded-Proto header present', ab.includes('X-Forwarded-Proto'));
    check('/api/: X-Request-ID header present', ab.includes('X-Request-ID'));
    check('/api/: proxy_pass to backend:5000/api/', ab.includes('proxy_pass http://backend:5000/api/'));

    // ── SPA fallback and static assets ──────────────────────────────────────
    console.log('\n--- / location SPA fallback ---');
    const rootBlock = conf.match(/location\s+\/\s*\{([^}]+)\}/s);
    check('/ location block is present', !!rootBlock);
    const rb = rootBlock ? rootBlock[1] : '';
    check('/ location: try_files SPA fallback present', rb.includes('try_files'));
    check('/ location: index.html fallback present', rb.includes('index.html'));

    // ── Frontend Document CSP Delivery (Step 8C) ─────────────────────────────
    console.log('\n--- Frontend Document Content-Security-Policy (Step 8C) ---');
    check('/ location: Content-Security-Policy header present', rb.includes('Content-Security-Policy'));
    check('/ location: Content-Security-Policy includes "always" directive', /Content-Security-Policy.*always;/s.test(rb));
    check('/ location: CSP default-src is "self"', rb.includes("default-src 'self'"));
    check('/ location: CSP script-src includes checkout.razorpay.com', rb.includes('https://checkout.razorpay.com'));
    check('/ location: CSP script-src includes accounts.google.com', rb.includes('https://accounts.google.com'));
    check('/ location: CSP script-src has no unsafe-eval', !rb.includes("'unsafe-eval'"));
    check('/ location: CSP style-src includes fonts.googleapis.com', rb.includes('https://fonts.googleapis.com'));
    check('/ location: CSP font-src includes fonts.gstatic.com', rb.includes('https://fonts.gstatic.com'));
    check('/ location: CSP img-src includes res.cloudinary.com', rb.includes('https://res.cloudinary.com'));
    check('/ location: CSP img-src includes *.googleusercontent.com', rb.includes('https://*.googleusercontent.com'));
    check('/ location: CSP img-src includes checkout.razorpay.com', rb.includes('https://checkout.razorpay.com'));
    check('/ location: CSP connect-src includes www.googleapis.com', rb.includes('https://www.googleapis.com'));
    check('/ location: CSP connect-src includes api.razorpay.com', rb.includes('https://api.razorpay.com'));
    check('/ location: CSP connect-src includes api.cloudinary.com', rb.includes('https://api.cloudinary.com'));
    check('/ location: CSP connect-src includes accounts.google.com', rb.includes('https://accounts.google.com'));
    check('/ location: CSP connect-src includes WebSocket schemes (wss: ws:)', rb.includes('wss:') && rb.includes('ws:'));
    check('/ location: CSP frame-src includes accounts.google.com', rb.includes('frame-src') && rb.includes('https://accounts.google.com'));
    check('/ location: CSP frame-src includes api.razorpay.com', rb.includes('https://api.razorpay.com'));
    check('/ location: CSP frame-src includes checkout.razorpay.com', rb.includes('https://checkout.razorpay.com'));
    check('/ location: CSP object-src is "none"', rb.includes("object-src 'none'"));
    check('/ location: CSP base-uri is "self"', rb.includes("base-uri 'self'"));
    check('/ location: CSP form-action is "self"', rb.includes("form-action 'self'"));

    // ── Prevent Duplicate CSP Headers on API/Socket Endpoints ────────────────
    console.log('\n--- Non-Duplication Checks ---');
    check('/api/ location does NOT set Nginx CSP (Express Helmet handles it)', !ab.includes('Content-Security-Policy'));
    check('/socket.io/ location does NOT set Nginx CSP', !sb.includes('Content-Security-Policy'));

    // ── Global security headers still present ───────────────────────────────
    console.log('\n--- Global security headers ---');
    check('X-Frame-Options SAMEORIGIN present', conf.includes('X-Frame-Options'));
    check('X-Content-Type-Options nosniff present', conf.includes('X-Content-Type-Options'));
    check('Referrer-Policy present', conf.includes('Referrer-Policy'));

    // ── Nginx file note (no runtime validation tool available) ──────────────
    console.log('\n  NOTE: nginx -t (syntax validation) requires Docker/nginx runtime.');
    console.log('  Runtime validation of these changes is outstanding pending a container build.\n');

    console.log('============================================================');
    if (failures.length === 0) {
        console.log(`QUIRO Step 8B Task 3 Nginx: ALL ${pass}/${total} CHECKS PASSED (static)`);
    } else {
        console.error(`QUIRO Step 8B Task 3 Nginx: ${pass}/${total} — FAILURES:`);
        failures.forEach(f => console.error('  - ' + f));
    }
    console.log('============================================================\n');

    if (failures.length > 0) throw new Error(`${failures.length} Nginx check(s) failed`);
    return { pass, total };
}

if (require.main === module) {
    runNginxConfigTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL]:', err.message);
            process.exit(1);
        });
}

module.exports = { runNginxConfigTests };
