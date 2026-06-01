import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.js';
import { CartProvider } from './context/CartContext.js';
import ProtectedRoute from './components/features/ProtectedRoute.js';
import BuyerLayout from './components/features/BuyerLayout.js';
import WholesalerLayout from './components/features/WholesalerLayout.js';
import DeliveryLayout from './components/features/DeliveryLayout.js';
import ErrorBoundary from './components/features/ErrorBoundary.js';
import './components/primitives/tokens.css';
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import RegisterWholesaler from './pages/RegisterWholesaler.js';
import BuyerDashboard from './pages/BuyerDashboard.js';
import BuyerCatalog from './pages/BuyerCatalog.js';
import ProductDetail from './pages/ProductDetail.js';
import Cart from './pages/Cart.js';
import OrderConfirmation from './pages/OrderConfirmation.js';
import PaymentFlow from './pages/PaymentFlow.js';
import WholesalerDashboard from './pages/WholesalerDashboard.js';
import ProductManager from './pages/ProductManager.js';
import BuyerOrders from './pages/BuyerOrders.js';
import WholesalerOrders from './pages/WholesalerOrders.js';
import WholesalerOrderDetail from './pages/WholesalerOrderDetail.js';
import BuyerPayments from './pages/BuyerPayments.js';
import WholesalerPayments from './pages/WholesalerPayments.js';
import BuyerChat from './pages/BuyerChat.js';
import WholesalerChat from './pages/WholesalerChat.js';
import DeliveryDashboard from './pages/DeliveryDashboard.js';
import AdminDashboard from './pages/AdminDashboard.js';
import BuyerFavorites from './pages/BuyerFavorites.js';
import Settings from './pages/Settings.js';
import NotFound from './pages/NotFound.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              {/* ── Public ────────────────────────────────── */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register-wholesaler" element={<RegisterWholesaler />} />

              {/* ── Buyer routes (sidebar layout) ────────── */}
              <Route element={<ProtectedRoute allowedRoles={['buyer']} />}>
                <Route element={<BuyerLayout />}>
                  <Route path="/buyer" element={<BuyerDashboard />} />
                  <Route path="/buyer/catalog" element={<BuyerCatalog />} />
                  <Route path="/buyer/products/:id" element={<ProductDetail />} />
                  <Route path="/buyer/orders" element={<BuyerOrders />} />
                  <Route path="/buyer/cart" element={<Cart />} />
                  <Route path="/buyer/order-confirmation/:id" element={<OrderConfirmation />} />
                  <Route path="/buyer/payments" element={<BuyerPayments />} />
                  <Route path="/buyer/favorites" element={<BuyerFavorites />} />
                  <Route path="/buyer/chat" element={<BuyerChat />} />
                  <Route path="/buyer/pay/:orderId" element={<PaymentFlow />} />
                  <Route path="/buyer/settings" element={<Settings />} />
                </Route>
              </Route>

              {/* ── Wholesaler routes (sidebar layout) ───── */}
              <Route element={<ProtectedRoute allowedRoles={['wholesaler_admin', 'wholesaler_seller']} />}>
                <Route element={<WholesalerLayout />}>
                  <Route path="/wholesaler" element={<WholesalerDashboard />} />
                  <Route path="/wholesaler/products" element={<ProductManager />} />
                  <Route path="/wholesaler/orders" element={<WholesalerOrders />} />
                  <Route path="/wholesaler/orders/:id" element={<WholesalerOrderDetail />} />
                  <Route path="/wholesaler/payments" element={<WholesalerPayments />} />
                  <Route path="/wholesaler/chat" element={<WholesalerChat />} />
                  <Route path="/wholesaler/settings" element={<Settings />} />
                </Route>
              </Route>

              {/* ── Delivery routes (sidebar + bottom nav) ── */}
              <Route element={<ProtectedRoute allowedRoles={['delivery_operator']} />}>
                <Route element={<DeliveryLayout />}>
                  <Route path="/delivery" element={<DeliveryDashboard />} />
                </Route>
              </Route>

              {/* ── Admin routes ─────────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['platform_admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* ── 404 catch-all (doit rester en dernier) ── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
