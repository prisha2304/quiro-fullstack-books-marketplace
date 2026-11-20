const { pool } = require('./config/db');
const bcrypt = require('bcryptjs');

const seedEcommerce = async () => {
    try {
        console.log('Starting Ecommerce Production Seeding (120+ books)...');
        
        // 1. Setup Admin Seller
        const hashedPassword = await bcrypt.hash('password123', 10);
        await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role="ADMIN"',
            ['Amazon Admin', 'admin', 'admin@booknest.com', hashedPassword, 'ADMIN']
        );
        
        const [userRows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
        const sellerId = userRows[0].id;

        // 2. Clear and Setup Categories
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.execute('TRUNCATE TABLE categories');
        await pool.execute('TRUNCATE TABLE books');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        // Add original_price column if missing
        try {
            await pool.query('ALTER TABLE books ADD COLUMN original_price DECIMAL(10, 2) DEFAULT NULL AFTER price');
        } catch (e) {}

        const categories = [
            ['Self Help', 'Sparkles'],
            ['Business', 'Briefcase'],
            ['Fiction', 'Book'],
            ['Programming', 'Code'],
            ['Engineering', 'Cpu'],
            ['UPSC', 'Shield'],
            ['JEE', 'Target'],
            ['School', 'School'],
            ['Mystery', 'Search'],
            ['Romance', 'Heart'],
            ['Science', 'Flask'],
            ['History', 'History'],
            ['Biography', 'User']
        ];

        for (const [name, icon] of categories) {
            await pool.execute('INSERT INTO categories (name, icon) VALUES (?, ?)', [name, icon]);
        }

        const baseBooks = [
            // Self Help
            ['Atomic Habits', 'James Clear', 'An easy and proven way to build good habits.', 'Self Help', 249, 399, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'],
            ['Think and Grow Rich', 'Napoleon Hill', 'The success secrets of billionaires.', 'Self Help', 149, 249, 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400'],
            ['Deep Work', 'Cal Newport', 'Rules for focused success in a distracted world.', 'Self Help', 279, 399, 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400'],
            ['Ikigai', 'Héctor García', 'The Japanese secret to a long and happy life.', 'Self Help', 199, 299, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'],
            ['Can\'t Hurt Me', 'David Goggins', 'Master your mind and defy the odds.', 'Self Help', 349, 499, 'https://images.unsplash.com/photo-1531243269054-5ebf6f3b0b6e?w=400'],
            
            // Business / Finance
            ['Rich Dad Poor Dad', 'Robert Kiyosaki', 'What the rich teach their kids about money.', 'Business', 229, 349, 'https://images.unsplash.com/photo-1592492159418-39f319320569?w=400'],
            ['The Psychology of Money', 'Morgan Housel', 'Timeless lessons on wealth and happiness.', 'Business', 249, 399, 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400'],
            ['Zero to One', 'Peter Thiel', 'Notes on startups and how to build the future.', 'Business', 279, 399, 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400'],
            ['Lean Startup', 'Eric Ries', 'How today\'s entrepreneurs use continuous innovation.', 'Business', 299, 449, 'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?w=400'],
            ['The Intelligent Investor', 'Benjamin Graham', 'The definitive book on value investing.', 'Business', 399, 599, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'],

            // Programming
            ['Clean Code', 'Robert C. Martin', 'A handbook of agile software craftsmanship.', 'Programming', 599, 999, 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400'],
            ['Design Patterns', 'Erich Gamma', 'Elements of reusable object-oriented software.', 'Programming', 799, 1299, 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400'],
            ['Introduction to Algorithms', 'CLRS', 'Comprehensive algorithms guide.', 'Programming', 999, 1799, 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400'],
            ['Eloquent JavaScript', 'Marijn Haverbeke', 'A modern introduction to programming.', 'Programming', 499, 799, 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400'],
            ['Cracking the Coding Interview', 'Gayle Laakmann', '189 programming questions and solutions.', 'Programming', 699, 1299, 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400'],
            ['Computer Networks', 'Andrew Tanenbaum', 'Systems approach to networking.', 'Programming', 599, 999, 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400'],
            ['Operating System Concepts', 'Silberschatz', 'Fundamental OS principles.', 'Programming', 599, 999, 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400'],

            // Science / Engineering
            ['The Gene', 'Siddhartha Mukherjee', 'An intimate history of the gene.', 'Science', 399, 599, 'https://images.unsplash.com/photo-1532187875605-186482a63d91?w=400'],
            ['Sapiens', 'Yuval Noah Harari', 'A brief history of humankind.', 'Science', 299, 499, 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400'],
            ['Brief History of Time', 'Stephen Hawking', 'From big bang to black holes.', 'Science', 249, 399, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'],
            ['Mechanical Engineering', 'J.K. Gupta', 'Conventional and objective type.', 'Engineering', 449, 699, 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400'],
            ['Electrical Technology', 'B.L. Theraja', 'Textbook of electrical engineering.', 'Engineering', 599, 899, 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400'],

            // Fiction
            ['The Alchemist', 'Paulo Coelho', 'A fable about following your dream.', 'Fiction', 149, 299, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'],
            ['Harry Potter & Sorcerer\'s Stone', 'J.K. Rowling', 'A young wizard\'s journey begins.', 'Fiction', 299, 499, 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400'],
            ['The Great Gatsby', 'F. Scott Fitzgerald', 'The classic American novel.', 'Fiction', 129, 199, 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400'],
            ['To Kill a Mockingbird', 'Harper Lee', 'A classic of modern American literature.', 'Fiction', 199, 349, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'],

            // UPSC / Education
            ['Indian Polity', 'M. Laxmikanth', 'Comprehensive guide for civil services.', 'UPSC', 549, 849, 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400'],
            ['Modern History of India', 'Spectrum', 'Short summary of modern India.', 'UPSC', 229, 349, 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400'],
            ['Quantitative Aptitude', 'R.S. Aggarwal', 'Most popular math prep book.', 'JEE', 399, 599, 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400'],
            ['Wings of Fire', 'A.P.J. Abdul Kalam', 'Autobiography of a visionary.', 'Biography', 149, 249, 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400'],
        ];

        // Generate 120+ by cloning and varying
        const finalBooks = [];
        const conditions = ['New', 'Like New', 'Good', 'Acceptable'];
        
        for (let i = 0; i < 4; i++) {
            baseBooks.forEach(b => {
                const bClone = [...b];
                const priceVar = 0.8 + (Math.random() * 0.4);
                // Round price to nearest clean Rupee
                bClone[4] = Math.round(bClone[4] * priceVar);
                finalBooks.push({
                    title: i === 0 ? b[0] : `${b[0]} (Edition ${i + 1})`,
                    author: b[1],
                    description: b[2],
                    genre: b[3],
                    price: bClone[4],
                    originalPrice: b[5],
                    condition: conditions[Math.floor(Math.random() * conditions.length)],
                    cover_image: b[6],
                    sale_enabled: true,
                    swap_enabled: Math.random() > 0.5
                });
            });
        }

        for (const book of finalBooks) {
            await pool.execute(
                'INSERT INTO books (title, author, description, genre, price, original_price, `condition`, cover_image, seller_id, sale_enabled, swap_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [book.title, book.author, book.description, book.genre, book.price, book.originalPrice, book.condition, book.cover_image, sellerId, book.sale_enabled, book.swap_enabled]
            );
        }

        console.log(`Successfully seeded ${finalBooks.length} books.`);
        process.exit(0);

    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
};

seedEcommerce();
