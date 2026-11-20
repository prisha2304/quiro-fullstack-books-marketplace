const { pool } = require('../config/db');
const Book = require('../models/Book');
const AIChatHistory = require('../models/AIChatHistory');
const Tesseract = require('tesseract.js');

class AIVisualSearchService {
    /**
     * Clean and normalize OCR recognized text
     */
    static normalizeExtractedText(rawText) {
        if (!rawText) return '';
        return rawText
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract potential title/author candidates from OCR tokens
     */
    static extractCandidates(cleanText) {
        const words = cleanText.split(' ').filter(w => w.length > 2);
        const candidates = [];

        // Full line / phrases
        if (cleanText.length > 3) candidates.push(cleanText.slice(0, 50));

        // 2-word and 3-word n-grams
        for (let i = 0; i < words.length - 1; i++) {
            candidates.push(`${words[i]} ${words[i + 1]}`);
            if (i < words.length - 2) {
                candidates.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
            }
        }

        return [...new Set(candidates)];
    }

    /**
     * Identify book from image buffer or filepath
     */
    static async identifyBookCover({ imageBuffer, filePath, userId = null, sessionId = null }) {
        let recognizedText = '';
        const imageSource = imageBuffer || filePath;

        if (!imageSource) {
            throw new Error('Image source is required for visual search');
        }

        try {
            // Run local OCR
            const { data } = await Tesseract.recognize(imageSource, 'eng', {
                logger: () => {}
            });
            recognizedText = data.text || '';
        } catch (ocrErr) {
            console.error('OCR processing notice (fallback search activated):', ocrErr.message);
        }

        const cleanText = this.normalizeExtractedText(recognizedText);
        const candidates = this.extractCandidates(cleanText);

        let matches = [];
        let identified = null;
        let confidence = 0;

        if (candidates.length > 0) {
            // Search catalog with candidates
            for (const query of candidates.slice(0, 6)) {
                const [rows] = await pool.query(`
                    SELECT b.*, u.full_name as seller_name, u.role as seller_role
                    FROM books b
                    JOIN users u ON b.seller_id = u.id
                    WHERE (b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ?) AND b.status = 'available'
                    ORDER BY b.rating DESC
                    LIMIT 5
                `, [`%${query}%`, `%${query}%`, `%${query}%`]);

                if (rows.length > 0) {
                    matches = rows;
                    const top = rows[0];
                    identified = {
                        title: top.title,
                        author: top.author,
                        genre: top.genre,
                        isbn: top.isbn || null
                    };

                    // Compute confidence based on string match ratio
                    const topTitleLower = top.title.toLowerCase();
                    const cleanLower = cleanText.toLowerCase();
                    if (cleanLower.includes(topTitleLower) || topTitleLower.includes(cleanLower)) {
                        confidence = 94;
                    } else if (cleanLower.includes(top.author?.toLowerCase() || '')) {
                        confidence = 86;
                    } else {
                        confidence = 72;
                    }
                    break;
                }
            }
        }

        // If no candidate matches, fallback to top popular books or graceful message
        if (!identified) {
            const [fallback] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.status = 'available'
                ORDER BY b.rating DESC, b.views DESC
                LIMIT 3
            `);
            matches = fallback;
            confidence = 35;
            identified = {
                title: 'Book Cover',
                author: 'Unknown',
                confidence: 35
            };
        } else {
            identified.confidence = confidence;
        }

        // Persist interaction in history
        const summaryResponse = confidence >= 50
            ? `Looks like you're looking for **"${identified.title}"** ${identified.author ? `by ${identified.author}` : ''} (${confidence}% match confidence).`
            : "I couldn't confidently identify this book from the cover image. Here are our top trending marketplace titles or you can search by title:";

        await AIChatHistory.create({
            user_id: userId,
            session_id: sessionId,
            message: `[Image Upload] Visual Book Search: ${cleanText.slice(0, 60) || 'Book Cover'}`,
            response: summaryResponse,
            recommended_books: matches
        });

        return {
            success: true,
            identified: {
                ...identified,
                confidence
            },
            confidenceLabel: confidence >= 90 ? 'High confidence match' : (confidence >= 70 ? 'Likely match' : (confidence >= 50 ? 'Possible match' : 'Uncertain match')),
            matches,
            cleanText,
            followUps: [
                'Find cheaper copies',
                'Show Like New',
                'Compare available editions',
                'Is this worth buying?',
                'Books similar to this'
            ]
        };
    }
}

module.exports = AIVisualSearchService;
