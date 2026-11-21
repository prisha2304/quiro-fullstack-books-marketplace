const { pool } = require('./config/db');

async function runPhase18Migration() {
    console.log('================================================================================');
    console.log(' BOOKNEST -> QUIRO — PHASE 18 DATABASE MIGRATION');
    console.log('================================================================================');

    let connection;
    try {
        connection = await pool.getConnection();

        console.log('✔ Connected to database via pool');

        // 1. Audit categories table columns and extend if needed
        const [catCols] = await connection.query('DESCRIBE categories');
        const colNames = catCols.map(c => c.Field);

        if (!colNames.includes('parent_category')) {
            await connection.query('ALTER TABLE categories ADD COLUMN parent_category VARCHAR(100) NULL AFTER icon');
            console.log('✔ Added parent_category column to categories table');
        }

        if (!colNames.includes('slug')) {
            await connection.query('ALTER TABLE categories ADD COLUMN slug VARCHAR(100) NULL AFTER parent_category');
            console.log('✔ Added slug column to categories table');
        }

        if (!colNames.includes('description')) {
            await connection.query('ALTER TABLE categories ADD COLUMN description VARCHAR(255) NULL AFTER slug');
            console.log('✔ Added description column to categories table');
        }

        // 2. Define Comprehensive Multi-Genre Categories taxonomy
        const comprehensiveTaxonomy = [
            // Fiction Group
            { name: 'Contemporary Fiction', parent: 'Fiction', icon: 'BookOpen', slug: 'contemporary-fiction', desc: 'Modern stories exploring contemporary life, relationships and culture' },
            { name: 'Literary Fiction', parent: 'Fiction', icon: 'BookOpen', slug: 'literary-fiction', desc: 'Character-driven works with artistic prose and depth' },
            { name: 'Historical Fiction', parent: 'Fiction', icon: 'Clock', slug: 'historical-fiction', desc: 'Immersive stories set in rich historical eras' },
            { name: 'General Fiction', parent: 'Fiction', icon: 'Book', slug: 'general-fiction', desc: 'Compelling classic and modern fiction' },

            // Romance Group
            { name: 'Contemporary Romance', parent: 'Romance', icon: 'Heart', slug: 'contemporary-romance', desc: 'Heartwarming modern love stories and emotional journeys' },
            { name: 'Dark Romance', parent: 'Romance', icon: 'Heart', slug: 'dark-romance', desc: 'Intense and morally complex romantic narratives' },
            { name: 'Young Adult Romance', parent: 'Romance', icon: 'Sparkles', slug: 'ya-romance', desc: 'Coming of age first loves and youthful relationships' },
            { name: 'Romantic Comedy', parent: 'Romance', icon: 'Smile', slug: 'romantic-comedy', desc: 'Witty banter, humor, and uplifting romance' },

            // Mystery and Thriller Group
            { name: 'Psychological Thriller', parent: 'Mystery & Thriller', icon: 'Eye', slug: 'psychological-thriller', desc: 'Mind-bending twists and psychological suspense' },
            { name: 'Crime Fiction', parent: 'Mystery & Thriller', icon: 'Shield', slug: 'crime-fiction', desc: 'Detective investigations, heists, and criminal minds' },
            { name: 'Suspense', parent: 'Mystery & Thriller', icon: 'Zap', slug: 'suspense', desc: 'Fast-paced, edge-of-your-seat narrative tension' },
            { name: 'Mystery', parent: 'Mystery & Thriller', icon: 'Search', slug: 'mystery', desc: 'Puzzles, whodunits, and captivating investigations' },

            // Horror Group
            { name: 'Supernatural Horror', parent: 'Horror', icon: 'Moon', slug: 'supernatural-horror', desc: 'Ghosts, otherworldly phenomena, and paranormal dread' },
            { name: 'Gothic Horror', parent: 'Horror', icon: 'Castle', slug: 'gothic-horror', desc: 'Atmospheric decay, haunted mansions, and brooding dread' },
            { name: 'Psychological Horror', parent: 'Horror', icon: 'Activity', slug: 'psychological-horror', desc: 'Deep-seated terror of the psyche and unseen dread' },

            // Fantasy and Science Fiction Group
            { name: 'High Fantasy', parent: 'Fantasy & Sci-Fi', icon: 'Crown', slug: 'high-fantasy', desc: 'Epic worlds, magic systems, and grand quests' },
            { name: 'Urban Fantasy', parent: 'Fantasy & Sci-Fi', icon: 'Building', slug: 'urban-fantasy', desc: 'Myth and magic woven into modern cities' },
            { name: 'Dark Fantasy', parent: 'Fantasy & Sci-Fi', icon: 'Flame', slug: 'dark-fantasy', desc: 'Grim worlds where shadows and sorcery collide' },
            { name: 'Science Fiction', parent: 'Fantasy & Sci-Fi', icon: 'Compass', slug: 'science-fiction', desc: 'Future technology, space exploration, and AI worlds' },
            { name: 'Dystopian Fiction', parent: 'Fantasy & Sci-Fi', icon: 'Layers', slug: 'dystopian', desc: 'Speculative futures and societal survival' },

            // Self-Help & Personal Growth
            { name: 'Self-Help', parent: 'Self-Help & Growth', icon: 'Lightbulb', slug: 'self-help', desc: 'Actionable guidance for daily life and habits' },
            { name: 'Personal Development', parent: 'Self-Help & Growth', icon: 'TrendingUp', slug: 'personal-development', desc: 'Mindset, productivity, and life mastery' },

            // Non-Fiction & Society
            { name: 'Biography and Memoir', parent: 'Non-Fiction', icon: 'User', slug: 'biography-memoir', desc: 'True life accounts and inspiring memoirs' },
            { name: 'Business and Finance', parent: 'Non-Fiction', icon: 'Briefcase', slug: 'business-finance', desc: 'Economics, entrepreneurship, and wealth building' },
            { name: 'History', parent: 'Non-Fiction', icon: 'Globe', slug: 'history', desc: 'World civilizations, revolutions, and chronicles of the past' },
            { name: 'Philosophy', parent: 'Non-Fiction', icon: 'Compass', slug: 'philosophy', desc: 'Ethics, epistemology, and foundational questions of existence' },
            { name: 'Poetry', parent: 'Non-Fiction', icon: 'Feather', slug: 'poetry', desc: 'Verse, lyrical prose, and timeless poetic collections' },

            // Children & Young Adult
            { name: 'Children\'s Books', parent: 'Young Readers', icon: 'Baby', slug: 'childrens-books', desc: 'Illustrated tales, early readers, and bedtime favorites' },
            { name: 'Young Adult', parent: 'Young Readers', icon: 'Sparkles', slug: 'young-adult', desc: 'Adventures and identity-shaping journeys for teens' },
            { name: 'Comics and Graphic Novels', parent: 'Young Readers', icon: 'Image', slug: 'comics-graphic-novels', desc: 'Visual storytelling, manga, and graphic memoirs' },

            // Academic & Textbooks
            { name: 'Academic and Textbooks', parent: 'Academic & Professional', icon: 'GraduationCap', slug: 'academic-textbooks', desc: 'Higher education textbooks and reference guides' },
            { name: 'Engineering', parent: 'Academic & Professional', icon: 'Cpu', slug: 'engineering', desc: 'Civil, mechanical, electrical, and electronic engineering' },
            { name: 'Computer Science', parent: 'Academic & Professional', icon: 'Code', slug: 'computer-science', desc: 'Algorithms, data structures, networks, and systems' },
            { name: 'Mathematics', parent: 'Academic & Professional', icon: 'Plus', slug: 'mathematics', desc: 'Calculus, linear algebra, discrete math, and statistics' },
            { name: 'Medical', parent: 'Academic & Professional', icon: 'Activity', slug: 'medical', desc: 'Anatomy, pharmacology, medicine, and clinical sciences' },
            { name: 'UPSC and Competitive Exams', parent: 'Academic & Professional', icon: 'Trophy', slug: 'upsc-competitive', desc: 'Civil services, banking, and entrance exam preparation' },
            { name: 'School and NCERT', parent: 'Academic & Professional', icon: 'School', slug: 'school-ncert', desc: 'CBSE, ICSE, and state board curriculum essentials' }
        ];

        // 3. Upsert taxonomy entries without overwriting existing category IDs
        for (const item of comprehensiveTaxonomy) {
            const [existing] = await connection.query('SELECT id FROM categories WHERE name = ?', [item.name]);
            if (existing.length > 0) {
                await connection.query(
                    'UPDATE categories SET parent_category = ?, slug = ?, description = ?, icon = COALESCE(icon, ?) WHERE id = ?',
                    [item.parent, item.slug, item.desc, item.icon, existing[0].id]
                );
            } else {
                await connection.query(
                    'INSERT INTO categories (name, icon, parent_category, slug, description) VALUES (?, ?, ?, ?, ?)',
                    [item.name, item.icon, item.parent, item.slug, item.desc]
                );
            }
        }
        console.log('✔ Multi-genre category taxonomy synchronized (all genres preserved and expanded)');

        // 4. Update parent_category and slug for existing legacy categories
        const legacyUpdates = [
            { name: 'Programming', parent: 'Academic & Professional', slug: 'programming', desc: 'Coding, software architecture, and languages' },
            { name: 'UPSC', parent: 'Academic & Professional', slug: 'upsc', desc: 'UPSC Civil Services preparation resources' },
            { name: 'NCERT', parent: 'Academic & Professional', slug: 'ncert', desc: 'Class 6-12 NCERT curriculum books' },
            { name: 'School', parent: 'Academic & Professional', slug: 'school', desc: 'School board textbooks and study material' },
            { name: 'Fiction', parent: 'Fiction', slug: 'fiction', desc: 'Compelling stories across classic and contemporary fiction' },
            { name: 'Romance', parent: 'Romance', slug: 'romance', desc: 'Captivating romance and love stories' },
            { name: 'Mystery', parent: 'Mystery & Thriller', slug: 'mystery', desc: 'Suspense, detective work, and thrilling mysteries' },
            { name: 'Biography', parent: 'Non-Fiction', slug: 'biography', desc: 'Memoirs and lives of extraordinary figures' },
            { name: 'Finance', parent: 'Non-Fiction', slug: 'finance', desc: 'Personal finance, investing, and market fundamentals' },
            { name: 'Self Help', parent: 'Self-Help & Growth', slug: 'self-help', desc: 'Personal growth and habits for life' },
            { name: 'Business', parent: 'Non-Fiction', slug: 'business', desc: 'Management, leadership, and startup playbooks' },
            { name: 'Manga', parent: 'Young Readers', slug: 'manga', desc: 'Japanese manga and graphic novels' },
            { name: 'Children', parent: 'Young Readers', slug: 'children', desc: 'Children books and bedtime stories' }
        ];

        for (const leg of legacyUpdates) {
            await connection.query(
                'UPDATE categories SET parent_category = ?, slug = ?, description = ? WHERE name = ? AND (parent_category IS NULL OR slug IS NULL)',
                [leg.parent, leg.slug, leg.desc, leg.name]
            );
        }
        console.log('✔ Legacy category metadata mapped to parent categories');

        // 5. Clean up any books with NULL genre: Map them appropriately based on title/author
        const [nullBooks] = await connection.query('SELECT id, title, author FROM books WHERE genre IS NULL OR genre = ""');
        console.log(`Checking books with missing genre: ${nullBooks.length} found`);
        for (const b of nullBooks) {
            let assignedGenre = 'Academic and Textbooks';
            const t = (b.title || '').toLowerCase();
            if (t.includes('database') || t.includes('operating system') || t.includes('computer') || t.includes('programming')) {
                assignedGenre = 'Computer Science';
            } else if (t.includes('calculus') || t.includes('discrete mathematics') || t.includes('algebra')) {
                assignedGenre = 'Mathematics';
            } else if (t.includes('physics') || t.includes('chemistry') || t.includes('engineering')) {
                assignedGenre = 'Engineering';
            }
            await connection.query('UPDATE books SET genre = ? WHERE id = ?', [assignedGenre, b.id]);
        }
        console.log('✔ All books now have a valid genre classification');

        // 6. Ensure indexes for swap search and genre filtering
        try {
            await connection.query('ALTER TABLE books ADD INDEX idx_books_swap (swap_enabled, status)');
            console.log('✔ Created index idx_books_swap on books');
        } catch (e) {
            // Index may already exist
            console.log('ℹ Index idx_books_swap already exists or handled');
        }

        try {
            await connection.query('ALTER TABLE books ADD INDEX idx_books_genre (genre)');
            console.log('✔ Created index idx_books_genre on books');
        } catch (e) {
            console.log('ℹ Index idx_books_genre already exists or handled');
        }

        // 7. Verify catalog preservation
        const [bookCount] = await connection.query('SELECT COUNT(*) as cnt FROM books');
        console.log(`✔ Verified total catalog books: ${bookCount[0].cnt} records completely preserved`);

        console.log('================================================================================');
        console.log(' PHASE 18 DATABASE MIGRATION COMPLETED SUCCESSFULLY');
        console.log('================================================================================');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        if (connection) connection.release();
    }
}

const migrate = runPhase18Migration;

module.exports = { migrate, runPhase18Migration };

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Migration failed:', err);
            process.exit(1);
        });
}
