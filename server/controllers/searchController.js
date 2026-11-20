const SearchService = require('../services/searchService');
const BookSimilarityService = require('../services/bookSimilarityService');
const AIService = require('../services/aiService');

const search = async (req, res) => {
    try {
        const results = await SearchService.searchBooks(req.query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error searching catalog', error: error.message });
    }
};

const getSuggestions = async (req, res) => {
    try {
        const { q = '', limit = 8 } = req.query;
        const suggestions = await SearchService.getSuggestions(q, parseInt(limit, 10));
        res.json(suggestions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching search suggestions', error: error.message });
    }
};

const getTrending = async (req, res) => {
    try {
        const trending = await SearchService.getTrendingSearches();
        res.json(trending);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching trending searches', error: error.message });
    }
};

const getSimilar = async (req, res) => {
    try {
        const { id } = req.params;
        const [similar, cheaper] = await Promise.all([
            BookSimilarityService.getSimilarBooks(id, 6),
            BookSimilarityService.getCheaperAlternatives(id, 4)
        ]);
        res.json({ similar, cheaper });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching similar books', error: error.message });
    }
};

const aiStructuredSearch = async (req, res) => {
    try {
        const { naturalQuery = '' } = req.body;
        if (!naturalQuery.trim()) {
            return res.status(400).json({ message: 'Natural language search query is required' });
        }

        const structuredFilters = AIService.extractSearchFilters(naturalQuery);
        const searchResults = await SearchService.searchBooks(structuredFilters);

        res.json({
            naturalQuery,
            structuredFilters,
            searchResults
        });
    } catch (error) {
        res.status(500).json({ message: 'Error processing AI search', error: error.message });
    }
};

module.exports = {
    search,
    getSuggestions,
    getTrending,
    getSimilar,
    aiStructuredSearch
};
