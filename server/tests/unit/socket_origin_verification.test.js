/**
 * QUIRO — Step 7F-2: Socket.IO Origin Security Verification Test Suite
 * 
 * Tests the actual Socket.IO handshake and WebSocket transport:
 * 1. Production origin https://quiro.in can connect.
 * 2. http://localhost:5173 is rejected in production.
 * 3. http://127.0.0.1:5173 is rejected in production.
 * 4. An unrelated external origin (https://malicious-site.com) is rejected.
 * 5. Unauthorized origins are rejected using WebSocket-only transport.
 * 6. Unauthorized origins are rejected using Polling transport.
 * 7. Valid authenticated clients continue to connect with JWT.
 * 8. Existing development localhost connections continue working.
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
const ioClient = require(path.join(__dirname, '../../../client/node_modules/socket.io-client'));
const socketModule = require('../../socket');

const TEST_JWT_SECRET = 'test_secret_quiro_socket_origin_verification_32chars';
process.env.JWT_SECRET = TEST_JWT_SECRET;

function createTestToken(userId) {
    return jwt.sign({ id: userId, email: `user${userId}@example.com` }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

function connectClient(url, options) {
    return new Promise((resolve) => {
        const client = ioClient.io(url, {
            reconnection: false,
            timeout: 2000,
            forceNew: true,
            ...options
        });

        let finished = false;

        client.on('connect', () => {
            if (!finished) {
                finished = true;
                resolve({ success: true, client });
            }
        });

        client.on('connect_error', (err) => {
            if (!finished) {
                finished = true;
                client.disconnect();
                resolve({ success: false, error: err.message });
            }
        });

        // Safety timeout in case no event fires
        setTimeout(() => {
            if (!finished) {
                finished = true;
                client.disconnect();
                resolve({ success: false, error: 'TIMEOUT' });
            }
        }, 2500);
    });
}

async function runSocketOriginSecurityTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-2: Socket.IO Origin Security Verification');
    console.log('============================================================\n');

    let passedChecks = 0;
    let totalChecks = 0;

    function assertCheck(desc, condition) {
        totalChecks++;
        if (condition) {
            passedChecks++;
            console.log(`  [PASS] Check ${totalChecks}: ${desc}`);
        } else {
            console.error(`  [FAIL] Check ${totalChecks}: ${desc}`);
            throw new Error(`Assertion failed: ${desc}`);
        }
    }

    // -------------------------------------------------------------
    // Part 1: Production Mode Tests
    // -------------------------------------------------------------
    console.log('--- Phase 1: Production Mode Handshake Tests ---');
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://quiro.in';

    const prodServer = http.createServer();
    const prodIo = socketModule.init(prodServer);

    await new Promise(r => prodServer.listen(0, '127.0.0.1', r));
    const prodPort = prodServer.address().port;
    const prodUrl = `http://127.0.0.1:${prodPort}`;

    const validToken = createTestToken(101);

    try {
        // Test 1: Production origin https://quiro.in can connect (Polling)
        const test1 = await connectClient(prodUrl, {
            transports: ['polling'],
            extraHeaders: { origin: 'https://quiro.in' }
        });
        assertCheck('Test 1A: Production origin https://quiro.in connects over polling', test1.success === true);
        if (test1.client) test1.client.disconnect();

        // Test 1B: Production origin https://quiro.in can connect (WebSocket)
        const test1b = await connectClient(prodUrl, {
            transports: ['websocket'],
            extraHeaders: { origin: 'https://quiro.in' }
        });
        assertCheck('Test 1B: Production origin https://quiro.in connects over websocket', test1b.success === true);
        if (test1b.client) test1b.client.disconnect();

        // Test 2: http://localhost:5173 is rejected in production
        const test2 = await connectClient(prodUrl, {
            transports: ['polling', 'websocket'],
            extraHeaders: { origin: 'http://localhost:5173' }
        });
        assertCheck('Test 2: http://localhost:5173 is rejected in production', test2.success === false);

        // Test 3: http://127.0.0.1:5173 is rejected in production
        const test3 = await connectClient(prodUrl, {
            transports: ['polling', 'websocket'],
            extraHeaders: { origin: 'http://127.0.0.1:5173' }
        });
        assertCheck('Test 3: http://127.0.0.1:5173 is rejected in production', test3.success === false);

        // Test 4: Unrelated external origin is rejected
        const test4 = await connectClient(prodUrl, {
            transports: ['polling', 'websocket'],
            extraHeaders: { origin: 'https://malicious-site.com' }
        });
        assertCheck('Test 4: Unrelated external origin (https://malicious-site.com) is rejected', test4.success === false);

        // Test 5: Unauthorized origins rejected using WebSocket-only transport
        const test5 = await connectClient(prodUrl, {
            transports: ['websocket'],
            extraHeaders: { origin: 'http://localhost:5173' }
        });
        assertCheck('Test 5: Unauthorized origin strictly rejected over WebSocket-only transport', test5.success === false);

        // Test 6: Unauthorized origins rejected using Polling transport
        const test6 = await connectClient(prodUrl, {
            transports: ['polling'],
            extraHeaders: { origin: 'http://localhost:5173' }
        });
        assertCheck('Test 6: Unauthorized origin strictly rejected over Polling transport', test6.success === false);

        // Test 7: Valid authenticated clients continue to connect
        const test7 = await connectClient(prodUrl, {
            transports: ['websocket'],
            extraHeaders: { origin: 'https://quiro.in' },
            auth: { token: validToken }
        });
        assertCheck('Test 7: Authenticated client with valid JWT connects successfully', test7.success === true);

        // Verify authenticated user presence and room joining
        if (test7.client) {
            let joinedPersonalRoom = false;
            test7.client.emit('join', 101);
            await new Promise(r => setTimeout(r, 100));
            assertCheck('Test 7B: isUserOnline(101) confirms presence registered', socketModule.isUserOnline(101) === true);
            test7.client.disconnect();
        }

        // Test 7C: Invalid JWT token is rejected by authentication middleware
        const test7c = await connectClient(prodUrl, {
            transports: ['websocket'],
            extraHeaders: { origin: 'https://quiro.in' },
            auth: { token: 'invalid_tampered_jwt_token' }
        });
        assertCheck('Test 7C: Invalid JWT token rejected during handshake authentication', test7c.success === false);

    } finally {
        await new Promise(r => prodServer.close(r));
    }

    // -------------------------------------------------------------
    // Part 2: Development Mode Tests
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Development Mode Handshake Tests ---');
    process.env.NODE_ENV = 'development';
    process.env.CLIENT_URL = 'http://localhost:5173';

    const devServer = http.createServer();
    const devIo = socketModule.init(devServer);

    await new Promise(r => devServer.listen(0, '127.0.0.1', r));
    const devPort = devServer.address().port;
    const devUrl = `http://127.0.0.1:${devPort}`;

    try {
        // Test 8A: http://localhost:5173 connects in development
        const test8a = await connectClient(devUrl, {
            transports: ['polling', 'websocket'],
            extraHeaders: { origin: 'http://localhost:5173' }
        });
        assertCheck('Test 8A: http://localhost:5173 connects in development', test8a.success === true);
        if (test8a.client) test8a.client.disconnect();

        // Test 8B: http://127.0.0.1:5173 connects in development
        const test8b = await connectClient(devUrl, {
            transports: ['websocket'],
            extraHeaders: { origin: 'http://127.0.0.1:5173' }
        });
        assertCheck('Test 8B: http://127.0.0.1:5173 connects in development over websocket', test8b.success === true);
        if (test8b.client) test8b.client.disconnect();

        // Test 8C: Unrelated external origin is STILL rejected in development
        const test8c = await connectClient(devUrl, {
            transports: ['polling', 'websocket'],
            extraHeaders: { origin: 'https://attacker-domain.com' }
        });
        assertCheck('Test 8C: Unrelated external origin rejected even in development mode', test8c.success === false);

        // Test 8D: Non-browser connection without origin header connects in development
        const test8d = await connectClient(devUrl, {
            transports: ['websocket']
        });
        assertCheck('Test 8D: Connection without origin header connects', test8d.success === true);
        if (test8d.client) test8d.client.disconnect();

    } finally {
        await new Promise(r => devServer.close(r));
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-2 Socket.IO Verification: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runSocketOriginSecurityTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runSocketOriginSecurityTests };
