const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const initDB = async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    try {
        console.log('Creating database if not exists...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'quiro'}`);
        await connection.query(`USE ${process.env.DB_NAME || 'quiro'}`);

        console.log('Reading schema.sql...');
        const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

        console.log('Applying schema...');
        await connection.query(schema);

        console.log('Database initialized successfully!');
    } catch (error) {
        console.error('Error initializing database:', error.message);
    } finally {
        await connection.end();
    }
};

initDB();
