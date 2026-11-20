import axios from 'axios';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

export const searchBooks = async (query) => {
  if (!query) return [];
  try {
    const response = await axios.get(`${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=5`);
    return response.data.items || [];
  } catch (error) {
    console.error('Google Books API search error:', error);
    return [];
  }
};

export const parseBookData = (googleBook) => {
   const info = googleBook.volumeInfo;
   return {
     title: info.title || '',
     author: info.authors ? info.authors.join(', ') : '',
     description: info.description || '',
     publisher: info.publisher || '',
     publishedDate: info.publishedDate || '',
     genre: info.categories ? info.categories[0] : '',
     isbn: info.industryIdentifiers ? info.industryIdentifiers[0].identifier : '',
     cover_image: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : '',
     language: info.language || 'English',
     publication_year: info.publishedDate ? info.publishedDate.split('-')[0] : null
   };
};
