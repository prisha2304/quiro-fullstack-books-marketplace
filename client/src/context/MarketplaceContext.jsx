import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import cartService from '../services/cartService';
import wishlistService from '../services/wishlistService';
import bookService from '../services/bookService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const GUEST_CART_KEY = 'quiro_guest_cart';
const LEGACY_CART_KEY = 'fable_guest_cart';
const ANCIENT_CART_KEY = 'booknest_guest_cart';

const MarketplaceContext = createContext();

export const MarketplaceProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);

  // Read guest cart safely (supports new key with legacy fallback)
  const getGuestCart = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || localStorage.getItem(LEGACY_CART_KEY) || localStorage.getItem(ANCIENT_CART_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    if (user) {
      try {
        const [cartRes, wishlistRes] = await Promise.all([
          cartService.getCart(),
          wishlistService.getWishlist()
        ]);
        const items = cartRes.data || [];
        setCartCount(items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0));
        setWishlistCount((wishlistRes.data?.items || []).length);
        setWishlistIds(wishlistRes.data?.ids || []);
      } catch (error) {
        console.error('Error refreshing marketplace counts', error);
      }
    } else {
      const guestItems = getGuestCart();
      const count = guestItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
      setCartCount(count);
      setWishlistCount(0);
      setWishlistIds([]);
    }
  }, [user, getGuestCart]);

  // Handle user authentication transitions & guest cart merge
  useEffect(() => {
    if (user) {
      const guestItems = getGuestCart();
      if (guestItems.length > 0) {
        const mergeCarts = async () => {
          let mergedCount = 0;
          for (const item of guestItems) {
            try {
              const bookId = item.id || item.book_id;
              await cartService.addToCart(bookId);
              if (item.quantity > 1) {
                await cartService.updateQuantity(bookId, item.quantity);
              }
              mergedCount++;
            } catch (err) {
              console.warn(`Could not merge guest cart item ${item.id}:`, err.message);
            }
          }
          localStorage.removeItem(GUEST_CART_KEY);
          if (mergedCount > 0) {
            toast.success(`Merged ${mergedCount} guest item${mergedCount > 1 ? 's' : ''} with your account!`);
          }
          refreshCounts();
        };
        mergeCarts();
      } else {
        refreshCounts();
      }
    } else {
      refreshCounts();
    }
  }, [user, getGuestCart, refreshCounts]);

  const addToCart = async (bookId, bookData = null) => {
    if (user) {
      try {
        await cartService.addToCart(bookId);
        toast.success('Added to cart');
        refreshCounts();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to add to cart');
      }
    } else {
      // Guest mode: Store in localStorage
      try {
        let guestCart = getGuestCart();
        const existingIdx = guestCart.findIndex(item => (item.id || item.book_id) === bookId);

        if (existingIdx > -1) {
          guestCart[existingIdx].quantity = (parseInt(guestCart[existingIdx].quantity) || 1) + 1;
        } else {
          let bookInfo = bookData;
          if (!bookInfo || !bookInfo.title) {
            try {
              const res = await bookService.getBookById(bookId);
              bookInfo = res.data;
            } catch (e) {
              bookInfo = { id: bookId, title: 'Selected Book', price: 0 };
            }
          }

          guestCart.push({
            id: bookId,
            book_id: bookId,
            title: bookInfo.title || 'Book Title',
            author: bookInfo.author || 'Unknown Author',
            price: parseFloat(bookInfo.price) || 0,
            cover_image: bookInfo.cover_image || '',
            condition: bookInfo.condition || 'Good',
            genre: bookInfo.genre || 'General',
            seller_name: bookInfo.seller_name || 'QUIRO Reader',
            quantity: 1
          });
        }

        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCart));
        refreshCounts();
        toast.success('Added to guest cart');
      } catch (err) {
        toast.error('Failed to update guest cart');
      }
    }
  };

  const removeFromGuestCart = (bookId) => {
    const guestCart = getGuestCart().filter(item => (item.id || item.book_id) !== bookId);
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCart));
    refreshCounts();
    return guestCart;
  };

  const updateGuestCartQuantity = (bookId, quantity) => {
    if (quantity < 1) {
      return removeFromGuestCart(bookId);
    }
    const guestCart = getGuestCart().map(item => {
      if ((item.id || item.book_id) === bookId) {
        return { ...item, quantity };
      }
      return item;
    });
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCart));
    refreshCounts();
    return guestCart;
  };

  const clearGuestCart = () => {
    localStorage.removeItem(GUEST_CART_KEY);
    refreshCounts();
  };

  const toggleWishlist = async (bookId) => {
    if (!user) {
      toast('Please sign in to save books to your wishlist', { icon: '🔒' });
      return;
    }
    try {
      if (wishlistIds.includes(bookId)) {
        await wishlistService.removeFromWishlist(bookId);
        toast.success('Removed from wishlist');
      } else {
        await wishlistService.addToWishlist(bookId);
        toast.success('Added to wishlist');
      }
      refreshCounts();
    } catch (error) {
      toast.error('Wishlist action failed');
    }
  };

  return (
    <MarketplaceContext.Provider value={{ 
      cartCount, 
      wishlistCount, 
      wishlistIds, 
      refreshCounts, 
      addToCart, 
      toggleWishlist,
      getGuestCart,
      removeFromGuestCart,
      updateGuestCartQuantity,
      clearGuestCart
    }}>
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => useContext(MarketplaceContext);
