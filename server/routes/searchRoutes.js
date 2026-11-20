const express = require('express');
const router = express.Router();
const { 
    search, 
    getSuggestions, 
    getTrending, 
    getSimilar, 
    aiStructuredSearch 
} = require('../controllers/searchController');

router.get('/', search);
router.get('/suggestions', getSuggestions);
router.get('/trending', getTrending);
router.get('/similar/:id', getSimilar);
router.post('/ai-structured', aiStructuredSearch);

module.exports = router;
