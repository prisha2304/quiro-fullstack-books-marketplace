/**
 * QUIRO — JWT Token-Version Session Invalidation Test Suite
 *
 * Tests:
 * 1. New user registration token contains token_version (tv = 1)
 * 2. Password login token contains current token_version
 * 3. Google OAuth token contains current token_version
 * 4. Valid matching token is accepted by protect middleware
 * 5. Token missing tv claim is rejected (HTTP 401)
 * 6. Outdated/revoked token is rejected (HTTP 401)
 * 7. Password change increments token_version and invalidates previous tokens
 * 8. Failed password change does NOT increment token_version
 * 9. Admin can revoke a user's tokens (and missing user returns 404)
 * 10. Non-admin cannot revoke another user's tokens (HTTP 403)
 * 11. Logout increments token_version and invalidates existing sessions
 * 12. Deleted users remain rejected (HTTP 401)
 * 13. Expired tokens remain rejected (HTTP 401)
 *
 * SAFETY:
 * - Uses isolated local quiro_test database only.
 * - Cleans up only synthetic test users created in this run.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const axios = require('axios');
axios.defaults.proxy = false;

const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath });
}
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_characters_long_ok';

const { pool } = require('../../config/db');
const { app } = require('../../index');
const generateToken = require('../../utils/generateToken');

const TEST_PORT = 5095;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

async function runTests() {
    console.log('\n============================================================');
    console.log('QUIRO JWT Token-Version Session Invalidation Tests');
    console.log('============================================================\n');

    let passed = 0;
    let total = 0;
    const createdUserIds = [];
    let serverInstance = null;

    function assertCheck(desc, condition) {
        total++;
        if (condition) {
            passed++;
            console.log(`  [PASS] Check ${total}: ${desc}`);
        } else {
            console.error(`  [FAIL] Check ${total}: ${desc}`);
            throw new Error(`Assertion failed: ${desc}`);
        }
    }

    try {
        serverInstance = await new Promise((resolve) => {
            const s = http.createServer(app);
            s.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
        });

        const ts = Date.now();
        const email = `tv_user_${ts}@quirotest.local`;
        const username = `tvuser_${ts}`;
        const password = 'Password123!';

        // 1. Register new user
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            full_name: 'Token Version Test User',
            username,
            email,
            password
        });
        assertCheck('Registration returns HTTP 201 and token', regRes.status === 201 && Boolean(regRes.data.token));
        const userId = regRes.data.id;
        createdUserIds.push(userId);

        const regDecoded = jwt.verify(regRes.data.token, process.env.JWT_SECRET);
        assertCheck('New user token contains tv === 1', regDecoded.id === userId && regDecoded.tv === 1);

        // 2. Valid matching token accepted
        const profRes = await axios.get(`${BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${regRes.data.token}` }
        });
        assertCheck('Valid matching token accepted (HTTP 200)', profRes.status === 200 && profRes.data.id === userId);

        // 3. Missing tv claim rejected
        const legacyToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
        let missingTvStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${legacyToken}` }
            });
        } catch (err) {
            missingTvStatus = err.response?.status;
        }
        assertCheck('Token missing tv claim is rejected with HTTP 401', missingTvStatus === 401);

        // 4. Failed password change does NOT increment token_version
        let failedPwdStatus = null;
        try {
            await axios.put(`${BASE_URL}/users/change-password`, {
                currentPassword: 'WrongPassword!',
                newPassword: 'NewPassword456!'
            }, {
                headers: { Authorization: `Bearer ${regRes.data.token}` }
            });
        } catch (err) {
            failedPwdStatus = err.response?.status;
        }
        assertCheck('Failed password change returns HTTP 401', failedPwdStatus === 401);

        const profAfterFailedPwd = await axios.get(`${BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${regRes.data.token}` }
        });
        assertCheck('Failed password change does not increment token_version', profAfterFailedPwd.data.token_version === 1);

        // 5. Successful password change increments token_version and invalidates old token
        const pwdChangeRes = await axios.put(`${BASE_URL}/users/change-password`, {
            currentPassword: password,
            newPassword: 'NewPassword456!'
        }, {
            headers: { Authorization: `Bearer ${regRes.data.token}` }
        });
        assertCheck('Successful password change returns HTTP 200', pwdChangeRes.status === 200);

        let oldTokenAfterPwdStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${regRes.data.token}` }
            });
        } catch (err) {
            oldTokenAfterPwdStatus = err.response?.status;
        }
        assertCheck('Previous token invalidated after password change (HTTP 401)', oldTokenAfterPwdStatus === 401);

        // 6. Login token contains updated token_version (tv = 2)
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            identifier: email,
            password: 'NewPassword456!'
        });
        const loginDecoded = jwt.verify(loginRes.data.token, process.env.JWT_SECRET);
        assertCheck('Login token contains updated tv === 2', loginRes.status === 200 && loginDecoded.tv === 2);

        // 7. Google OAuth token contains current token_version
        const origGoogleClientId = process.env.GOOGLE_CLIENT_ID;
        const origFetch = global.fetch;
        process.env.GOOGLE_CLIENT_ID = 'test_google_client_id.apps.googleusercontent.com';
        global.fetch = async () => ({
            ok: true,
            json: async () => ({
                aud: process.env.GOOGLE_CLIENT_ID,
                iss: 'https://accounts.google.com',
                email_verified: true,
                sub: `google_sub_${ts}`,
                email,
                name: 'Token Version Test User'
            })
        });
        let googleToken = null;
        try {
            const gRes = await axios.post(`${BASE_URL}/auth/google`, { idToken: 'fake_google_id_token' });
            googleToken = gRes.data.token;
            const gDecoded = jwt.verify(googleToken, process.env.JWT_SECRET);
            assertCheck('Google OAuth token contains current tv === 2', gRes.status === 200 && gDecoded.tv === 2);
        } finally {
            global.fetch = origFetch;
            if (origGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
            else process.env.GOOGLE_CLIENT_ID = origGoogleClientId;
        }

        // 8. Logout invalidates all active sessions for user
        const logoutRes = await axios.post(`${BASE_URL}/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${loginRes.data.token}` }
        });
        assertCheck('Logout returns HTTP 200', logoutRes.status === 200);

        let tokenAfterLogoutStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${googleToken}` }
            });
        } catch (err) {
            tokenAfterLogoutStatus = err.response?.status;
        }
        assertCheck('Active session token rejected after logout (HTTP 401)', tokenAfterLogoutStatus === 401);

        // Re-login to get tv = 3
        const login2Res = await axios.post(`${BASE_URL}/auth/login`, {
            identifier: email,
            password: 'NewPassword456!'
        });
        const login2Decoded = jwt.verify(login2Res.data.token, process.env.JWT_SECRET);
        assertCheck('Post-logout login issues tv === 3', login2Decoded.tv === 3);

        // 9. Non-admin cannot revoke another user's tokens
        let nonAdminRevokeStatus = null;
        try {
            await axios.post(`${BASE_URL}/admin/users/${userId}/revoke-tokens`, {}, {
                headers: { Authorization: `Bearer ${login2Res.data.token}` }
            });
        } catch (err) {
            nonAdminRevokeStatus = err.response?.status;
        }
        assertCheck('Non-admin cannot revoke tokens (HTTP 403)', nonAdminRevokeStatus === 403);

        // 10. Admin can revoke a user's tokens (and missing user returns 404)
        const adminEmail = `tv_admin_${ts}@quirotest.local`;
        const adminReg = await axios.post(`${BASE_URL}/auth/register`, {
            full_name: 'TV Admin',
            username: `tvadmin_${ts}`,
            email: adminEmail,
            password
        });
        const adminId = adminReg.data.id;
        createdUserIds.push(adminId);
        await pool.execute("UPDATE users SET role = 'ADMIN' WHERE id = ?", [adminId]);

        const adminRevokeRes = await axios.post(`${BASE_URL}/admin/users/${userId}/revoke-tokens`, {}, {
            headers: { Authorization: `Bearer ${adminReg.data.token}` }
        });
        assertCheck('Admin revoke-tokens returns HTTP 200 and increments version to 4',
            adminRevokeRes.status === 200 && adminRevokeRes.data.token_version === 4);

        let afterAdminRevokeStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${login2Res.data.token}` }
            });
        } catch (err) {
            afterAdminRevokeStatus = err.response?.status;
        }
        assertCheck('Revoked token rejected after admin revocation (HTTP 401)', afterAdminRevokeStatus === 401);

        let missingTargetStatus = null;
        try {
            await axios.post(`${BASE_URL}/admin/users/999999999/revoke-tokens`, {}, {
                headers: { Authorization: `Bearer ${adminReg.data.token}` }
            });
        } catch (err) {
            missingTargetStatus = err.response?.status;
        }
        assertCheck('Admin revoke-tokens for missing user returns HTTP 404', missingTargetStatus === 404);

        // 11. Expired tokens remain rejected
        const expiredToken = jwt.sign({ id: adminId, tv: 1 }, process.env.JWT_SECRET, { expiresIn: '-10s' });
        let expiredStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
        } catch (err) {
            expiredStatus = err.response?.status;
        }
        assertCheck('Expired token rejected with HTTP 401', expiredStatus === 401);

        // 12. Deleted users remain rejected
        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        const freshDeletedToken = generateToken(userId, 4);
        let deletedStatus = null;
        try {
            await axios.get(`${BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${freshDeletedToken}` }
            });
        } catch (err) {
            deletedStatus = err.response?.status;
        }
        assertCheck('Deleted user token rejected with HTTP 401', deletedStatus === 401);

        console.log(`\n============================================================`);
        console.log(`JWT Token-Version Tests: ALL ${passed}/${total} CHECKS PASSED`);
        console.log(`============================================================\n`);
    } finally {
        if (serverInstance) {
            await new Promise((resolve) => serverInstance.close(resolve));
        }
        if (createdUserIds.length > 0) {
            for (const uid of createdUserIds) {
                try {
                    await pool.execute('DELETE FROM users WHERE id = ?', [uid]);
                } catch (_) {}
            }
        }
        await pool.end();
    }
}

runTests().then(() => process.exit(0)).catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
