const { pool } = require('./config/db');
const bcrypt = require('bcryptjs');

const seedRich = async () => {
    try {
        console.log('Starting Rich Seeding...');
        
        // 1. Get/Create Admin User
        const hashedPassword = await bcrypt.hash('password123', 10);
        await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role="ADMIN"',
            ['Admin Seller', 'admin', 'admin@booknest.com', hashedPassword, 'ADMIN']
        );
        
        const [userRows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
        const sellerId = userRows[0].id;

        // 2. Refresh Categories
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.execute('TRUNCATE TABLE categories');
        await pool.execute('TRUNCATE TABLE books');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        const categories = [
            ['Programming', 'Code'], ['Engineering', 'Cpu'], ['Fiction', 'Book'],
            ['Romance', 'Heart'], ['Mystery', 'GlassWater'], ['Self Help', 'Lightbulb'],
            ['Business', 'Briefcase'], ['UPSC', 'Trophy'], ['School', 'School'],
            ['Children', 'Baby'], ['Competitive Exams', 'Target'], ['Science', 'Beaker'],
            ['Biographies', 'User'], ['History', 'Ancient'], ['Fantasy', 'Ghost'],
            ['Classic Literature', 'Scroll']
        ];

        for (const [name, icon] of categories) {
            await pool.execute('INSERT INTO categories (name, icon) VALUES (?, ?)', [name, icon]);
        }

        const bookData = [
            // Programming
            ['The Pragmatic Programmer', 'Andrew Hunt', 'Your journey to mastery.', 'Programming', 45.00, 'New', 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400', 1, 1],
            ['Clean Architecture', 'Robert C. Martin', 'A craftsman\'s guide.', 'Programming', 38.00, 'Like New', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 1, 1],
            ['You Don\'t Know JS', 'Kyle Simpson', 'Deep dive into JavaScript.', 'Programming', 25.00, 'New', 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400', 1, 0],
            ['Eloquent JavaScript', 'Marijn Haverbeke', 'A modern introduction.', 'Programming', 30.00, 'Good', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400', 1, 1],
            ['React Up & Running', 'Stoyan Stefanov', 'Building web applications.', 'Programming', 32.00, 'New', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400', 1, 1],

            // Business
            ['Lean Startup', 'Eric Ries', 'Innovation for growth.', 'Business', 22.00, 'New', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400', 1, 1],
            ['Good to Great', 'Jim Collins', 'Why some companies leap.', 'Business', 28.00, 'Like New', 'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?w=400', 1, 0],
            ['Shoe Dog', 'Phil Knight', 'Memoir by the creator of Nike.', 'Business', 18.00, 'Good', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 1, 1],
            ['Principles', 'Ray Dalio', 'Life and work.', 'Business', 35.00, 'New', 'https://images.unsplash.com/photo-1592492159418-39f319320569?w=400', 1, 0],
            ['Blue Ocean Strategy', 'W. Chan Kim', 'Uncontested market space.', 'Business', 29.00, 'New', 'https://images.unsplash.com/photo-1454165833019-d8b7c0042407?w=400', 1, 1],

            // Self Help
            ['Deep Work', 'Cal Newport', 'Focus in a distracted world.', 'Self Help', 19.50, 'New', 'https://images.unsplash.com/photo-1531243269054-5ebf6f3b0b6e?w=400', 1, 1],
            ['Can\'t Hurt Me', 'David Goggins', 'Master your mind.', 'Self Help', 24.00, 'New', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 1, 1],
            ['The 5 AM Club', 'Robin Sharma', 'Own your morning.', 'Self Help', 16.00, 'Good', 'https://images.unsplash.com/photo-1506485338023-6ce5f36692df?w=400', 1, 0],
            ['Influence', 'Robert Cialdini', 'Psychology of persuasion.', 'Self Help', 21.00, 'Like New', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 1, 1],
            ['Man\'s Search for Meaning', 'Viktor Frankl', 'Hope in suffering.', 'Self Help', 12.00, 'New', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400', 1, 1],

            // Fiction
            ['Where the Crawdads Sing', 'Delia Owens', 'A beautiful mystery.', 'Fiction', 18.00, 'New', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400', 1, 1],
            ['The Midnight Library', 'Matt Haig', 'Between life and death.', 'Fiction', 15.00, 'Like New', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 1, 0],
            ['Project Hail Mary', 'Andy Weir', 'Space survival thriller.', 'Fiction', 26.00, 'New', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', 1, 1],
            ['The Guest List', 'Lucy Foley', 'Mystery at a wedding.', 'Fiction', 16.50, 'Good', 'https://images.unsplash.com/photo-1592492159418-39f319320569?w=400', 1, 1],
            ['Normal People', 'Sally Rooney', 'A modern romance.', 'Fiction', 14.00, 'Like New', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400', 1, 0],

            // Mystery
            ['The Maid', 'Nita Prose', 'A charming mystery.', 'Mystery', 17.50, 'New', 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400', 1, 1],
            ['The Paris Apartment', 'Lucy Foley', 'Thrill in the heart of Paris.', 'Mystery', 19.00, 'New', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400', 1, 1],
            ['Verity', 'Colleen Hoover', 'A chilling thriller.', 'Mystery', 14.80, 'Good', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 1, 0],
            ['Local Woman Missing', 'Mary Kubica', 'Unfolding disappearance.', 'Mystery', 13.00, 'Acceptable', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400', 1, 1],
            ['The Last Thing He Told Me', 'Laura Dave', 'A family secret.', 'Mystery', 18.20, 'New', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', 1, 1],

            // Romance
            ['It Ends with Us', 'Colleen Hoover', 'Powerful journey of love.', 'Romance', 15.60, 'New', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400', 1, 1],
            ['The Love Hypothesis', 'Ali Hazelwood', 'Science and romance.', 'Romance', 14.00, 'Like New', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400', 1, 1],
            ['Red, White & Royal Blue', 'Casey McQuiston', 'A royal affair.', 'Romance', 16.00, 'Good', 'https://images.unsplash.com/photo-1592492159418-39f319320569?w=400', 1, 0],
            ['The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid', 'A Hollywood legend.', 'Romance', 19.00, 'New', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 1, 1],
            ['The Unhoneymooners', 'Christina Lauren', 'Enemies to lovers.', 'Romance', 13.50, 'Acceptable', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 1, 1],

            // Science / Engineering
            ['Astrophysics for People in a Hurry', 'Neil deGrasse Tyson', 'Universe in small bites.', 'Science', 12.00, 'New', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', 1, 1],
            ['The Gene', 'Siddhartha Mukherjee', 'History of genetics.', 'Science', 32.00, 'Like New', 'https://images.unsplash.com/photo-1532187875605-186482a63d91?w=400', 1, 0],
            ['Why We Sleep', 'Matthew Walker', 'The power of slumber.', 'Science', 22.00, 'New', 'https://images.unsplash.com/photo-1531243269054-5ebf6f3b0b6e?w=400', 1, 1],
            ['Fundamentals of Thermodynamics', 'Claus Borgnakke', 'Engineering basics.', 'Engineering', 95.00, 'Good', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400', 1, 1],
            ['Introduction to Electrodynamics', 'David J. Griffiths', 'Standard physics text.', 'Engineering', 75.00, 'Acceptable', 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400', 1, 0],

            // UPSC / Competitive
            ['Indian Polity', 'M. Laxmikanth', 'Bible for UPSC.', 'UPSC', 55.00, 'New', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400', 1, 1],
            ['A Brief History of Modern India', 'Spectrum', 'History made easy.', 'UPSC', 12.00, 'Good', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400', 1, 1],
            ['Quantitative Aptitude', 'R.S. Aggarwal', 'Math prep.', 'Competitive Exams', 35.00, 'New', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400', 1, 0],
            ['Verbal & Non-Verbal Reasoning', 'R.S. Aggarwal', 'Logic prep.', 'Competitive Exams', 32.00, 'Like New', 'https://images.unsplash.com/photo-1592492159418-39f319320569?w=400', 1, 1],
            ['India after Gandhi', 'Ramachandra Guha', 'Post-independence history.', 'History', 45.00, 'New', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 1, 1],

            // Add more to reach ~80
        ];

        // Duplicate for variety with different conditions and prices
        const extendedData = [];
        for (let i = 0; i < 2; i++) {
            bookData.forEach(book => {
                const newBook = [...book];
                newBook[4] = (newBook[4] * (0.8 + Math.random() * 0.4)).toFixed(2); // Randomize price +/- 20%
                newBook[5] = ['New', 'Like New', 'Good', 'Acceptable'][Math.floor(Math.random() * 4)];
                extendedData.push(newBook);
            });
        }

        for (const [title, author, desc, genre, price, cond, cover, sale, swap] of extendedData) {
            await pool.execute(
                'INSERT INTO books (title, author, description, genre, price, `condition`, cover_image, seller_id, sale_enabled, swap_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [title, author, desc, genre, price, cond, cover, sellerId, sale === 1, swap === 1]
            );
        }

        console.log('Seeded ' + extendedData.length + ' books successfully!');
        process.exit(0);

    } catch (err) {
        console.error('Rich Seeding Error:', err);
        process.exit(1);
    }
};

seedRich();
