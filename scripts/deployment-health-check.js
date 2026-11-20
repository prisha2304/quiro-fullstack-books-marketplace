
const http = require('http');

const BASE_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:5000';

function checkEndpoint(path) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${path}`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ raw: data, status: 'OK' });
                    }
                } else {
                    reject(new Error(`Endpoint ${path} returned status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function runDeploymentHealthGate() {
    console.log(`🔍 Executing Deployment Health Gate on ${BASE_URL}...`);

    try {
        const live = await checkEndpoint('/api/health/live');
        console.log('✔ Liveness Check:', live.status);

        const ready = await checkEndpoint('/api/health/ready');
        console.log('✔ Readiness Check:', ready.status);

        const deps = await checkEndpoint('/api/health/dependencies');
        console.log('✔ Dependency Check:', deps.status, '| DB:', deps.checks?.database?.status);

        if (live.status !== 'UP' || ready.status !== 'UP' || deps.checks?.database?.status !== 'UP') {
            console.error('❌ Critical health check failed. Aborting deployment.');
            process.exit(1);
        }

        console.log('🎉 Deployment Health Gate PASSED. Application is safe for production traffic.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Deployment Health Gate FAILED:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runDeploymentHealthGate();
}

module.exports = { runDeploymentHealthGate };
