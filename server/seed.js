const { pool } = require('./config/db');
const bcrypt = require('bcryptjs');

const seed = async () => {
    try {
        console.log('Cleaning up existing database tables for fresh seed (TRUNCATE)...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        const tables = [
            'payments', 'order_items', 'orders', 'cart_items', 'wishlists', 
            'swap_requests', 'notifications', 'reviews', 'books', 'categories', 
            'coupons', 'users', 'user_activity', 'messages', 'conversations'
        ];
        for (const table of tables) {
            const [checkTable] = await pool.query(`SHOW TABLES LIKE '${table}'`);
            if (checkTable.length > 0) {
                await pool.query(`TRUNCATE TABLE ${table}`);
            }
        }
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Tables truncated successfully.');

        // 1. Create Sellers and Users
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        // Official BookNest Admin
        await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            ['BookNest Official', 'official_booknest', 'official@booknest.com', hashedPassword, 'ADMIN']
        );
        
        // Community Sellers
        const communitySellers = [
            ['Sharma Book House', 'sharma_books', 'sharma@gmail.com'],
            ['Aditya Books & Tech', 'aditya_read', 'aditya@gmail.com'],
            ['Priya Novelty Corner', 'priya_novel', 'priya@gmail.com'],
            ['Rahul Competitive Prep', 'rahul_tech', 'rahul@gmail.com'],
            ['Amit Manga Spot', 'amit_manga', 'amit@gmail.com']
        ];
        
        for (const [name, username, email] of communitySellers) {
            await pool.execute(
                'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
                [name, username, email, hashedPassword, 'USER']
            );
        }
        
        // Get all user ids
        const [userRows] = await pool.execute('SELECT id, username FROM users');
        const userMap = {};
        userRows.forEach(row => {
            userMap[row.username] = row.id;
        });
        
        const officialId = userMap['official_booknest'];
        const communityIds = Object.values(userMap).filter(id => id !== officialId);

        // 2. Seed Categories
        const categories = [
            ['Programming', 'Code'], 
            ['UPSC', 'Trophy'], 
            ['NCERT', 'BookOpen'], 
            ['School', 'School'],
            ['Engineering', 'Cpu'], 
            ['Fiction', 'Book'], 
            ['Romance', 'Heart'], 
            ['Mystery', 'Search'], 
            ['Biography', 'User'], 
            ['Finance', 'TrendingUp'], 
            ['Self Help', 'Lightbulb'], 
            ['Business', 'Briefcase'], 
            ['History', 'Book'], 
            ['Medical', 'Activity'], 
            ['Manga', 'Zap'], 
            ['Children', 'Baby']
        ];

        for (const [name, icon] of categories) {
             await pool.execute('INSERT INTO categories (name, icon) VALUES (?, ?)', [name, icon]);
        }

        // 3. Seed Coupons
        const coupons = [
            ['WELCOME50', 50, 100.00, 200.00],
            ['BOOKNEST20', 20, 300.00, 500.00],
            ['DEAL10', 10, 50.00, 100.00]
        ];
        for (const [code, pct, maxD, minO] of coupons) {
            await pool.execute(
                'INSERT INTO coupons (code, discount_percent, max_discount, min_order_value) VALUES (?, ?, ?, ?)',
                [code, pct, maxD, minO]
            );
        }

        // 4. Generate Book Dataset
        console.log('Generating large books dataset...');
        
        // High quality cover images from Unsplash
        const covers = [
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1589998059171-988d887df646?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1531243269054-5ebf6f3b0b6e?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1618666012174-83b441c0bc76?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400'
        ];

        const baseBooks = {
            'Programming': [
                { title: 'Effective Java', author: 'Joshua Bloch', desc: 'A guide to Java platform best practices.', publisher: 'Addison-Wesley' },
                { title: 'Core Java Volume I', author: 'Cay S. Horstmann', desc: 'Detailed reference for fundamentals of Java.', publisher: 'Prentice Hall' },
                { title: 'Java: The Complete Reference', author: 'Herbert Schildt', desc: 'Full programming guide to Java SE.', publisher: 'McGraw Hill' },
                { title: 'Learning Python', author: 'Mark Lutz', desc: 'Deep introduction to core Python language.', publisher: 'O\'Reilly Media' },
                { title: 'Python Crash Course', author: 'Eric Matthes', desc: 'A hands-on, project-based introduction.', publisher: 'No Starch Press' },
                { title: 'Fluent Python', author: 'Luciano Ramalho', desc: 'Write idiomatic and modern Python code.', publisher: 'O\'Reilly' },
                { title: 'Programming in C++', author: 'Bjarne Stroustrup', desc: 'Introductory book by the creator of C++.', publisher: 'Addison-Wesley' },
                { title: 'C++ Primer', author: 'Stanley B. Lippman', desc: 'The definitive tutorial guide to C++.', publisher: 'Prentice Hall' },
                { title: 'Introduction to Algorithms (CLRS)', author: 'Thomas H. Cormen', desc: 'The bible of data structures and algorithms.', publisher: 'MIT Press' },
                { title: 'Grokking Algorithms', author: 'Aditya Bhargava', desc: 'An illustrated guide for programmers.', publisher: 'Manning' },
                { title: 'Elements of Programming Interviews', author: 'Adnan Aziz', desc: 'Excellent competitive programming challenges.', publisher: 'EPI' },
                { title: 'Competitive Programming 4', author: 'Steven Halim', desc: 'The ultimate guide for ICPC contestants.', publisher: 'CP4' }
            ],
            'UPSC': [
                { title: 'Indian Polity for Civil Services', author: 'M. Laxmikanth', desc: 'Extremely popular guide on Indian constitution.', publisher: 'McGraw Hill' },
                { title: 'History of Modern India', author: 'Bipan Chandra', desc: 'Standard historical review for CSE aspirants.', publisher: 'Orient Blackswan' },
                { title: 'Certificate Physical and Human Geography', author: 'G.C. Leong', desc: 'Classic geography guide for UPSC exams.', publisher: 'Oxford University Press' },
                { title: 'Indian Economy', author: 'Ramesh Singh', desc: 'Comprehensive guide to national economics.', publisher: 'McGraw Hill' },
                { title: 'A Brief History of Modern India', author: 'Spectrum Editorial', desc: 'Compact modern history study guide.', publisher: 'Spectrum Books' },
                { title: 'Challenges to Internal Security', author: 'Ashok Kumar', desc: 'UPSC Mains security essay topics.', publisher: 'McGraw Hill' }
            ],
            'NCERT': [
                { title: 'NCERT Mathematics Class 10', author: 'NCERT Board', desc: 'Official government high school math textbook.', publisher: 'NCERT' },
                { title: 'NCERT Physics Class 12', author: 'NCERT Board', desc: 'Official secondary school physics course textbook.', publisher: 'NCERT' },
                { title: 'NCERT Chemistry Class 11', author: 'NCERT Board', desc: 'Official fundamental chemistry textbook.', publisher: 'NCERT' },
                { title: 'NCERT Biology Class 12', author: 'NCERT Board', desc: 'Science text for CBSE and competitive eligibility.', publisher: 'NCERT' },
                { title: 'Our Pasts: History Class 8', author: 'NCERT Board', desc: 'Social science and history textbook.', publisher: 'NCERT' },
                { title: 'Democratic Politics Class 9', author: 'NCERT Board', desc: 'Introduction to democratic civic systems.', publisher: 'NCERT' }
            ],
            'School': [
                { title: 'ICSE Understanding Mathematics Class 10', author: 'M.L. Aggarwal', desc: 'Comprehensive secondary school syllabus.', publisher: 'Arya Publications' },
                { title: 'Higher Secondary English Grammar', author: 'Wren & Martin', desc: 'Legendary English grammar reference textbook.', publisher: 'S. Chand' },
                { title: 'CBSE Physics Question Bank Class 12', author: 'Oswaal Editorial', desc: 'Model test questions and solutions.', publisher: 'Oswaal Books' },
                { title: 'Chemistry Lab Manual Class 10', author: 'Dr. Gita Sharma', desc: 'Laboratory practical guide book.', publisher: 'Laxmi Publications' }
            ],
            'Engineering': [
                { title: 'Advanced Engineering Mathematics', author: 'Erwin Kreyszig', desc: 'Bible of mathematical logic for developers.', publisher: 'Wiley' },
                { title: 'Microelectronic Circuits', author: 'Adel S. Sedra', desc: 'Ultimate circuits engineering guide.', publisher: 'Oxford University Press' },
                { title: 'Fluid Mechanics', author: 'Frank M. White', desc: 'Comprehensive fluid engineering principles.', publisher: 'McGraw Hill' },
                { title: 'Signals and Systems', author: 'Alan V. Oppenheim', desc: 'Signal processing engineering standard text.', publisher: 'Prentice Hall' },
                { title: 'Structural Analysis', author: 'Russell C. Hibbeler', desc: 'Civil engineering structural mechanics.', publisher: 'Pearson' }
            ],
            'Fiction': [
                { title: 'To Kill a Mockingbird', author: 'Harper Lee', desc: 'Pulitzer prize winning classic about race and justice.', publisher: 'J.B. Lippincott & Co.' },
                { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', desc: 'Tragic novel set in Jazz-age Long Island.', publisher: 'Charles Scribner\'s Sons' },
                { title: '1984', author: 'George Orwell', desc: 'Chilling dystopian story about totalitarian oversight.', publisher: 'Secker & Warburg' },
                { title: 'Animal Farm', author: 'George Orwell', desc: 'Satirical allegory about communism history.', publisher: 'Secker & Warburg' },
                { title: 'The Alchemist', author: 'Paulo Coelho', desc: 'Inspiring journey of self-determination and dreams.', publisher: 'HarperCollins' },
                { title: 'The Hobbit', author: 'J.R.R. Tolkien', desc: 'Legendary fantasy adventure of Bilbo Baggins.', publisher: 'George Allen & Unwin' }
            ],
            'Romance': [
                { title: 'Pride and Prejudice', author: 'Jane Austen', desc: 'Timeless romantic spark between Elizabeth and Darcy.', publisher: 'T. Egerton Whitehall' },
                { title: 'Fault in Our Stars', author: 'John Green', desc: 'Touching romance between young cancer survivors.', publisher: 'Dutton Books' },
                { title: 'The Notebook', author: 'Nicholas Sparks', desc: 'Poignant love tale of Noah and Allie.', publisher: 'Warner Books' },
                { title: 'It Ends with Us', author: 'Colleen Hoover', desc: 'Emotional contemporary romantic relationship drama.', publisher: 'Atria Books' },
                { title: 'The Love Hypothesis', author: 'Ali Hazelwood', desc: 'STEM academic romance fake-dating scenario.', publisher: 'Berkley' }
            ],
            'Mystery': [
                { title: 'Sherlock Holmes Omnibus', author: 'Arthur Conan Doyle', desc: 'Complete cases of London\'s finest investigator.', publisher: 'Ward Lock & Co.' },
                { title: 'The Da Vinci Code', author: 'Dan Brown', desc: 'Conspiracy thriller through Paris and Rome.', publisher: 'Doubleday' },
                { title: 'The Silent Patient', author: 'Alex Michaelides', desc: 'Psychological thriller about murder and silence.', publisher: 'Celadon Books' },
                { title: 'And Then There Were None', author: 'Agatha Christie', desc: 'Best-selling mystery puzzle of isolate victims.', publisher: 'Collins Crime Club' },
                { title: 'Verity', author: 'Colleen Hoover', desc: 'Chilling psychological suspense.', publisher: 'Grand Central Publishing' }
            ],
            'Biography': [
                { title: 'Wings of Fire', author: 'A.P.J. Abdul Kalam', desc: 'Autobiography of India\'s beloved Missile Man.', publisher: 'Universities Press' },
                { title: 'Steve Jobs', author: 'Walter Isaacson', desc: 'Definitive biography of Apple\'s visionary leader.', publisher: 'Simon & Schuster' },
                { title: 'The Diary of a Young Girl', author: 'Anne Frank', desc: 'Poignant journal of a Jewish girl hiding from Nazis.', publisher: 'Contact Publishing' },
                { title: 'Playing It My Way', author: 'Sachin Tendulkar', desc: 'Autobiography of cricket\'s greatest batsman.', publisher: 'Hodder & Stoughton' },
                { title: 'Long Walk to Freedom', author: 'Nelson Mandela', desc: 'Struggle against apartheid and racism.', publisher: 'Little, Brown' }
            ],
            'Finance': [
                { title: 'The Intelligent Investor', author: 'Benjamin Graham', desc: 'Bible of value investing philosophy.', publisher: 'Harper & Brothers' },
                { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', desc: 'Financial literacy concepts for beginners.', publisher: 'Warner Books' },
                { title: 'The Psychology of Money', author: 'Morgan Housel', desc: 'Timeless lessons on wealth and greed.', publisher: 'Harriman House' },
                { title: 'Think and Grow Rich', author: 'Napoleon Hill', desc: 'Inspirational money-making secrets plan.', publisher: 'Ralston Society' },
                { title: 'Guide to Indian Stock Market', author: 'Prasanna Chandra', desc: 'Corporate finance and investing on NSE/BSE.', publisher: 'McGraw Hill' }
            ],
            'Self Help': [
                { title: 'Atomic Habits', author: 'James Clear', desc: 'Tiny changes yielding massive life improvements.', publisher: 'Avery' },
                { title: 'The 7 Habits of Highly Effective People', author: 'Stephen R. Covey', desc: 'Classic roadmap to self-actualization.', publisher: 'Free Press' },
                { title: 'How to Win Friends and Influence People', author: 'Dale Carnegie', desc: 'Social psychology and networking bible.', publisher: 'Simon & Schuster' },
                { title: 'The Subtle Art of Not Giving a F*ck', author: 'Mark Manson', desc: 'Counter-intuitive guide to positive living.', publisher: 'HarperOne' },
                { title: 'Deep Work', author: 'Cal Newport', desc: 'Rules for focused success in a noisy world.', publisher: 'Grand Central' }
            ],
            'Business': [
                { title: 'Zero to One', author: 'Peter Thiel', desc: 'Secrets of startups and building the future.', publisher: 'Crown Business' },
                { title: 'The Lean Startup', author: 'Eric Ries', desc: 'Agile business practices for rapid testing.', publisher: 'Crown Business' },
                { title: 'Good to Great', author: 'Jim Collins', desc: 'Why some firms grow and others stay average.', publisher: 'HarperBusiness' },
                { title: 'Shoe Dog', author: 'Phil Knight', desc: 'Memoir by the founder of Nike sports.', publisher: 'Scribner' }
            ],
            'History': [
                { title: 'Sapiens', author: 'Yuval Noah Harari', desc: 'A brief history of human evolution and culture.', publisher: 'Harper' },
                { title: 'The Discovery of India', author: 'Jawaharlal Nehru', desc: 'Comprehensive essay of Indian culture and legacy.', publisher: 'Signet Press' },
                { title: 'India after Gandhi', author: 'Ramachandra Guha', desc: 'Masterful post-independence Indian history.', publisher: 'Picador' },
                { title: 'A History of the World', author: 'Andrew Marr', desc: 'Global review of civilizations.', publisher: 'Macmillan' }
            ],
            'Medical': [
                { title: 'Gray\'s Anatomy', author: 'Henry Gray', desc: 'Classic human anatomy reference handbook.', publisher: 'Lea & Febiger' },
                { title: 'The Emperor of All Maladies', author: 'Siddhartha Mukherjee', desc: 'Biography of cancer disease and pathology.', publisher: 'Scribner' },
                { title: 'General Anatomy', author: 'B.D. Chaurasia', desc: 'Standard medical college curriculum textbook.', publisher: 'CBS Publishers' },
                { title: 'Robbins Basic Pathology', author: 'Vinay Kumar', desc: 'Basic fundamentals of clinical pathology.', publisher: 'Saunders' }
            ],
            'Manga': [
                { title: 'One Piece Volume 1', author: 'Eiichiro Oda', desc: 'Gomu Gomu adventure of Monkey D. Luffy.', publisher: 'Shueisha' },
                { title: 'Naruto Volume 1', author: 'Masashi Kishimoto', desc: 'Ninja dreams of young Naruto Uzumaki.', publisher: 'Shueisha' },
                { title: 'Attack on Titan Vol. 1', author: 'Hajime Isayama', desc: 'Humanity\'s battle inside massive protective walls.', publisher: 'Kodansha' },
                { title: 'Demon Slayer Vol. 1', author: 'Koyoharu Gotouge', desc: 'Tanjiro\'s quest to cure demon-turned Nezuko.', publisher: 'Shueisha' },
                { title: 'Death Note Vol. 1', author: 'Tsugumi Ohba', desc: 'Mysterious notebook of execution power.', publisher: 'Shueisha' }
            ],
            'Children': [
                { title: 'Harry Potter and the Philosopher\'s Stone', author: 'J.K. Rowling', desc: 'Young wizard discovers magic school.', publisher: 'Bloomsbury' },
                { title: 'The Secret Garden', author: 'Frances Hodgson Burnett', desc: 'Lonely girl unearths a walled garden.', publisher: 'Heinemann' },
                { title: 'Charlotte\'s Web', author: 'E.B. White', desc: 'Spider plots to save the life of a pig.', publisher: 'Harper & Brothers' },
                { title: 'Alice in Wonderland', author: 'Lewis Carroll', desc: 'Fantasy trip down a rabbit hole.', publisher: 'Macmillan' }
            ]
        };

        const listConditions = ['New', 'Like New', 'Good', 'Acceptable'];
        const listLanguages = ['English', 'Hindi', 'Tamil', 'Spanish'];
        
        let counter = 0;
        const totalTarget = 420;
        
        console.log('Writing books to database...');
        
        while (counter < totalTarget) {
            for (const categoryName of Object.keys(baseBooks)) {
                if (counter >= totalTarget) break;
                
                const templates = baseBooks[categoryName];
                const baseInfo = templates[counter % templates.length];
                
                const duplicateIndex = Math.floor(counter / templates.length);
                const title = duplicateIndex > 0 ? `${baseInfo.title} (Edition ${duplicateIndex + 1})` : baseInfo.title;
                const author = baseInfo.author;
                const desc = `${baseInfo.desc} Highly recommended edition. This copy is well-preserved.`;
                const genre = categoryName;
                const publisher = baseInfo.publisher;
                
                const original_price = 150 + Math.floor(Math.random() * 1800);
                const discount = 10 + Math.floor(Math.random() * 40); // 10% to 50% discount
                const price = Math.round(original_price * (1 - discount/100));
                
                const condition = listConditions[Math.floor(Math.random() * listConditions.length)];
                const language = listLanguages[counter % listLanguages.length];
                const publication_year = 2012 + (counter % 12);
                const cover_image = covers[counter % covers.length];
                
                const stock = 1 + Math.floor(Math.random() * 4);
                const views = 5 + Math.floor(Math.random() * 950);
                const wishlist_count = Math.floor(views * (0.05 + Math.random() * 0.15));
                const rating = (3.5 + Math.random() * 1.5).toFixed(1);
                const review_count = Math.floor(views * (0.01 + Math.random() * 0.05));
                
                const isOfficial = (counter % 5 < 2);
                const seller_id = isOfficial ? officialId : communityIds[counter % communityIds.length];
                
                const sale_enabled = true;
                const swap_enabled = (!isOfficial && (counter % 3 === 0)); 

                const isbn = `97881${Math.floor(10000000 + Math.random() * 90000000)}`;

                await pool.execute(`
                    INSERT INTO books (
                        title, author, isbn, description, genre, language, publication_year, publisher,
                        price, original_price, \`condition\`, cover_image, seller_id, sale_enabled, swap_enabled,
                        stock, views, rating, review_count, wishlist_count, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
                `, [
                    title, author, isbn, desc, genre, language, publication_year, publisher,
                    price, original_price, condition, cover_image, seller_id, sale_enabled, swap_enabled,
                    stock, views, rating, review_count, wishlist_count
                ]);

                counter++;
            }
        }
        
        console.log('Seeding reviews...');
        const [bookRows] = await pool.execute('SELECT id, seller_id FROM books LIMIT 100');
        for (let i = 0; i < bookRows.length; i += 3) {
            const book = bookRows[i];
            const reviewerId = communityIds.find(id => id !== book.seller_id) || officialId;
            const rating = 4 + (i % 2);
            await pool.execute(
                'INSERT INTO reviews (book_id, reviewer_id, seller_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
                [book.id, reviewerId, book.seller_id, rating, 'Excellent condition and very polite exchange. Fast ship!']
            );
        }

        console.log(`Reseeded successfully! Seeded ${counter} books, 3 coupons, reviews, and 6 active users.`);
        process.exit(0);
    } catch (error) {
        console.error('Fatal seeding error:', error);
        process.exit(1);
    }
};

seed();
