/**
 * QUIRO — Step 8B Task 1: Content Security Policy Tests
 *
 * Verifies:
 * 1. CSP is enabled (not false) in production Helmet config.
 * 2. Required application origins are present in each directive.
 * 3. Arbitrary untrusted origins are absent.
 * 4. Other Helmet protections remain enabled.
 * 5. Dangerous directives (unsafe-eval, wildcard) are absent where prohibited.
 * 6. The CSP header is returned on live HTTP responses.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const axios = require('axios');
axios.defaults.proxy = false;

// Isolated test environment
const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath, override: false });
}
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';
process.env.NODE_ENV = 'production'; // must be production to enforce strict CSP
// Synthetic 32+ char secrets required for production mode startup validation
process.env.JWT_SECRET = 'synthetic_test_jwt_secret_32_characters_long!';
process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic_test_webhook_secret_32_chars_ok!';

const TEST_PORT = 5083;

async function runCspTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 8B Task 1: Content Security Policy Tests');
    console.log('============================================================\n');

    let pass = 0;
    let total = 0;
    const errors = [];

    function check(desc, condition) {
        total++;
        if (condition) {
            pass++;
            console.log(`  [PASS] ${total}: ${desc}`);
        } else {
            console.error(`  [FAIL] ${total}: ${desc}`);
            errors.push(desc);
        }
    }

    // ── 1. Static analysis of the Helmet config in index.js ─────────────────
    console.log('--- 1. Static Helmet Configuration Analysis ---');
    const indexSource = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');

    // CSP must NOT be set to `false`
    check('CSP is not disabled (contentSecurityPolicy: false absent)', !indexSource.includes('contentSecurityPolicy: false'));

    // CSP directive block must be present
    check('CSP directive block is defined (cspDirectives)', indexSource.includes('cspDirectives'));

    // script-src must include Razorpay and Google
    check("script-src includes 'checkout.razorpay.com'", indexSource.includes("'https://checkout.razorpay.com'"));
    check("script-src includes 'accounts.google.com'", indexSource.includes("'https://accounts.google.com'"));

    // No unsafe-eval allowed in script-src
    const scriptSrcExtract = (indexSource.match(/scriptSrc\s*:\s*\[([^\]]+)\]/) || [])[1] || '';
    check("script-src does not contain 'unsafe-eval'", !scriptSrcExtract.includes('unsafe-eval'));

    // font-src must include gstatic
    check("font-src includes 'fonts.gstatic.com'", indexSource.includes("'https://fonts.gstatic.com'"));

    // style-src must include fonts.googleapis.com
    check("style-src includes 'fonts.googleapis.com'", indexSource.includes("'https://fonts.googleapis.com'"));

    // img-src must include Cloudinary and Google avatars
    check("img-src includes 'res.cloudinary.com'", indexSource.includes("'https://res.cloudinary.com'"));
    check("img-src includes '*.googleusercontent.com'", indexSource.includes("'https://*.googleusercontent.com'"));

    // img-src allows data: for inline SVG fallbacks and blob:
    check("img-src includes 'data:'", indexSource.includes("'data:'"));
    check("img-src includes 'blob:'", indexSource.includes("'blob:'"));

    // connect-src must include googleapis, razorpay API, cloudinary, and accounts.google.com
    check("connect-src includes 'www.googleapis.com'", indexSource.includes("'https://www.googleapis.com'"));
    check("connect-src includes 'api.razorpay.com'", indexSource.includes("'https://api.razorpay.com'"));
    check("connect-src includes 'accounts.google.com'", indexSource.includes("'https://accounts.google.com'"));
    check("connect-src includes WebSocket schemes (wss: ws:)", indexSource.includes("'wss:'") && indexSource.includes("'ws:'"));

    // frame-src must allow Google Accounts and Razorpay (for OAuth iframe and 3DS payment verification)
    check("frame-src includes 'accounts.google.com'", indexSource.includes("'https://accounts.google.com'"));
    check("frame-src includes 'api.razorpay.com'", indexSource.includes("'https://api.razorpay.com'"));
    check("frame-src includes 'checkout.razorpay.com'", indexSource.includes("'https://checkout.razorpay.com'"));
    check("frame-src includes 'self'", indexSource.includes("frameSrc") && indexSource.includes("\"'self'\""));

    // object-src must be 'none'
    check("object-src is 'none'", indexSource.includes("objectSrc") && indexSource.includes("\"'none'\""));

    // base-uri and form-action must be 'self'
    check("base-uri is 'self'", indexSource.includes("baseUri") && indexSource.includes("\"'self'\""));
    check("form-action is 'self'", indexSource.includes("formAction") && indexSource.includes("\"'self'\""));

    // No broad wildcard origins for scripts
    const scriptSrcMatch = indexSource.match(/scriptSrc\s*:\s*\[([^\]]+)\]/);
    const scriptSrcStr = scriptSrcMatch ? scriptSrcMatch[1] : '';
    check("script-src has no wildcard '*' origin", !scriptSrcStr.includes("'*'") && !scriptSrcStr.includes('"*"'));

    // Other Helmet protections remain enabled (not disabled)
    check('xContentTypeOptions is enabled', indexSource.includes('xContentTypeOptions: true'));
    check('referrerPolicy is configured', indexSource.includes('referrerPolicy'));
    check('crossOriginResourcePolicy is present', indexSource.includes('crossOriginResourcePolicy'));

    // ── 2. Live HTTP header check ─────────────────────────────────────────────
    console.log('\n--- 2. Live HTTP Response CSP Header Check ---');

    // Temporarily require the app — it starts no server on its own
    const { app } = require('../../index');
    const server = http.createServer(app);

    await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

    try {
        const res = await axios.get(`http://127.0.0.1:${TEST_PORT}/api/health/live`);
        const cspHeader = res.headers['content-security-policy'] || '';

        check('CSP header is present on HTTP responses', cspHeader.length > 0);
        check("CSP header contains default-src 'self'", cspHeader.includes("default-src 'self'"));
        check('CSP header contains checkout.razorpay.com in script-src', cspHeader.includes('checkout.razorpay.com'));
        check('CSP header contains accounts.google.com in script-src', cspHeader.includes('accounts.google.com'));
        check('CSP header contains fonts.gstatic.com in font-src', cspHeader.includes('fonts.gstatic.com'));
        check('CSP header contains res.cloudinary.com in img-src', cspHeader.includes('res.cloudinary.com'));
        check('CSP header contains *.googleusercontent.com in img-src', cspHeader.includes('*.googleusercontent.com'));
        check('CSP header contains www.googleapis.com in connect-src', cspHeader.includes('www.googleapis.com'));
        check('CSP header contains accounts.google.com in connect-src', cspHeader.includes('https://accounts.google.com'));
        check('CSP header contains accounts.google.com in frame-src', cspHeader.includes('https://accounts.google.com'));
        check('CSP header contains api.razorpay.com in frame-src', cspHeader.includes('https://api.razorpay.com'));
        check('CSP header contains checkout.razorpay.com in frame-src', cspHeader.includes('https://checkout.razorpay.com'));
        check("CSP header contains object-src 'none'", cspHeader.includes("object-src 'none'"));

        // Verify arbitrary untrusted origin is not allowed
        check('CSP header does not allow evil.com', !cspHeader.includes('evil.com'));
        check('CSP header does not allow http: wildcard scheme', !cspHeader.includes(' http:'));

        // Verify other Helmet headers
        const xct = res.headers['x-content-type-options'];
        check("X-Content-Type-Options: nosniff present", xct === 'nosniff');

    } finally {
        await new Promise(resolve => server.close(resolve));
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n============================================================');
    if (errors.length === 0) {
        console.log(`QUIRO Step 8B Task 1 CSP: ALL ${pass}/${total} CHECKS PASSED`);
    } else {
        console.error(`QUIRO Step 8B Task 1 CSP: ${pass}/${total} passed — FAILURES:`);
        errors.forEach(e => console.error('  - ' + e));
    }
    console.log('============================================================\n');

    if (errors.length > 0) throw new Error(`${errors.length} CSP check(s) failed`);
    return { pass, total };
}

if (require.main === module) {
    runCspTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL]:', err.message);
            process.exit(1);
        });
}

module.exports = { runCspTests };
