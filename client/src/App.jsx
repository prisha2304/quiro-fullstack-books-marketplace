import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from 'react-hot-toast';

// Core UI Components (Synchronous for Fast Initial Paint)
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Primary Public Pages (Eager / Fast TTI)
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Browse from './pages/Browse';
import BookDetails from './pages/BookDetails';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';

// Code-Split Dynamic Imports (Lazy Loaded)
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const Sell = lazy(() => import('./pages/Sell'));
const MyListings = lazy(() => import('./pages/MyListings'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));
const SellerDashboardAdvanced = lazy(() => import('./pages/SellerDashboardAdvanced'));
const SellerProfile = lazy(() => import('./pages/SellerProfile'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const ActivityCenter = lazy(() => import('./pages/ActivityCenter'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const SwapRequests = lazy(() => import('./pages/SwapRequests'));
const ExchangePayment = lazy(() => import('./pages/ExchangePayment'));
const ExchangeTracking = lazy(() => import('./pages/ExchangeTracking'));
const Chat = lazy(() => import('./pages/Chat'));
const Disputes = lazy(() => import('./pages/Disputes'));
const DisputeDetail = lazy(() => import('./pages/DisputeDetail'));

// Admin Sub-bundle (Lazy Loaded)
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOperations = lazy(() => import('./pages/admin/AdminOperations'));
const AdminAIOperations = lazy(() => import('./pages/admin/AdminAIOperations'));
const AdminMarketplaceIntelligence = lazy(() => import('./pages/admin/AdminMarketplaceIntelligence'));
const AdminProductionHealth = lazy(() => import('./pages/admin/AdminProductionHealth'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminBooks = lazy(() => import('./pages/admin/Books'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminSwaps = lazy(() => import('./pages/admin/Swaps'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));
const AdminDisputes = lazy(() => import('./pages/admin/Disputes'));

// Route Fallback Spinner
const PageFallback = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#FAF9F6]">
    <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mb-3"></div>
    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading QUIRO...</span>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <MarketplaceProvider>
            <SocketProvider>
              <Toaster position="top-center" reverseOrder={false} />
              <Router>
                <div className="min-h-screen bg-[--color-neutral-bg] flex flex-col font-sans transition-colors duration-300">
                  <Navbar />
                  <main className="flex-grow pt-[75px]">
                    <Suspense fallback={<PageFallback />}>
                      <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/browse" element={<Browse />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/book/:id" element={<BookDetails />} />
                        <Route path="/category/:name" element={<CategoryPage />} />
                        <Route path="/seller/:id" element={<SellerProfile />} />

                        {/* Protected Customer Routes */}
                        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                        <Route path="/orders/:id" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
                        <Route path="/swaps" element={<SwapRequests />} />
                        <Route path="/swaps/:id" element={<SwapRequests />} />
                        <Route path="/swaps/:id/payment" element={<ProtectedRoute><ExchangePayment /></ProtectedRoute>} />
                        <Route path="/swaps/:id/tracking" element={<ProtectedRoute><ExchangeTracking /></ProtectedRoute>} />
                        <Route path="/messages" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                        <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                        <Route path="/ai-insights" element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
                        <Route path="/activity" element={<ProtectedRoute><ActivityCenter /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
                        <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
                        <Route path="/disputes/:id" element={<ProtectedRoute><DisputeDetail /></ProtectedRoute>} />

                        {/* Protected Merchant / Seller Routes */}
                        <Route path="/sell" element={<ProtectedRoute><Sell /></ProtectedRoute>} />
                        <Route path="/sell/edit/:id" element={<ProtectedRoute><Sell /></ProtectedRoute>} />
                        <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
                        <Route path="/seller/orders" element={<ProtectedRoute><SellerOrders /></ProtectedRoute>} />
                        <Route path="/dashboard" element={<ProtectedRoute><SellerDashboardAdvanced /></ProtectedRoute>} />

                        {/* Protected Admin Routes */}
                        <Route path="/admin" element={<AdminLayout />}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="operations" element={<AdminOperations />} />
                          <Route path="ai-operations" element={<AdminAIOperations />} />
                          <Route path="intelligence" element={<AdminMarketplaceIntelligence />} />
                          <Route path="production-health" element={<AdminProductionHealth />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="books" element={<AdminBooks />} />
                          <Route path="categories" element={<AdminCategories />} />
                          <Route path="orders" element={<AdminOrders />} />
                          <Route path="swaps" element={<AdminSwaps />} />
                          <Route path="reviews" element={<AdminReviews />} />
                          <Route path="reports" element={<AdminReports />} />
                          <Route path="coupons" element={<AdminCoupons />} />
                          <Route path="announcements" element={<AdminAnnouncements />} />
                          <Route path="disputes" element={<AdminDisputes />} />
                        </Route>

                        {/* 404 Catch-All */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                </div>
              </Router>
            </SocketProvider>
          </MarketplaceProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
