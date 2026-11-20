
const fs = require('fs');
const path = require('path');

function verifyBackup(backupFilePath) {
    if (!backupFilePath || !fs.existsSync(backupFilePath)) {
        throw new Error('Backup file does not exist');
    }

    const stats = fs.statSync(backupFilePath);
    if (stats.size < 100) {
        throw new Error(`Backup file is suspiciously small (${stats.size} bytes)`);
    }

    const content = fs.readFileSync(backupFilePath, 'utf8').slice(0, 500);
    if (!content.includes('BookNest Database Backup') && !content.includes('CREATE TABLE')) {
        throw new Error('Backup file does not contain valid SQL schema dump headers');
    }

    return {
        valid: true,
        filePath: backupFilePath,
        sizeBytes: stats.size,
        verifiedAt: new Date().toISOString()
    };
}

if (require.main === module) {
    const backupDir = path.join(__dirname, '../backups');
    if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
        if (files.length > 0) {
            const latest = path.join(backupDir, files[files.length - 1]);
            const res = verifyBackup(latest);
            console.log('✔ Backup verification successful:', res);
            process.exit(0);
        }
    }
    console.log('No backup file found to verify.');
}

module.exports = { verifyBackup };
