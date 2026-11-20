const { pool } = require('../config/db');

class Category {
    static async findAll() {
        const [rows] = await pool.execute(`
            SELECT id, name, icon, parent_category, slug, description 
            FROM categories 
            ORDER BY 
                CASE 
                    WHEN parent_category = 'Fiction' THEN 1
                    WHEN parent_category = 'Romance' THEN 2
                    WHEN parent_category = 'Mystery & Thriller' THEN 3
                    WHEN parent_category = 'Fantasy & Sci-Fi' THEN 4
                    WHEN parent_category = 'Horror' THEN 5
                    WHEN parent_category = 'Self-Help & Growth' THEN 6
                    WHEN parent_category = 'Non-Fiction' THEN 7
                    WHEN parent_category = 'Young Readers' THEN 8
                    WHEN parent_category = 'Academic & Professional' THEN 9
                    ELSE 10
                END,
                name ASC
        `);
        return rows;
    }

    static async findAllGrouped() {
        const rows = await this.findAll();
        const grouped = {};
        for (const row of rows) {
            const group = row.parent_category || 'General';
            if (!grouped[group]) {
                grouped[group] = [];
            }
            grouped[group].push(row);
        }
        return grouped;
    }

    static async findByParent(parentCategory) {
        const [rows] = await pool.execute(
            'SELECT * FROM categories WHERE parent_category = ? ORDER BY name ASC',
            [parentCategory]
        );
        return rows;
    }
}

module.exports = Category;
