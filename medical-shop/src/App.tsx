import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/Account'
import { CartPage } from './pages/Cart'
import { CatalogPage } from './pages/Catalog'
import { CheckoutPage } from './pages/Checkout'
import { HomePage } from './pages/Home'
import { OrderPage } from './pages/Order'
import { ProductPage } from './pages/Product'
import { TrackPage } from './pages/Track'
import { StoreProvider } from './store'
import { AdminDashboard, AdminLogin, AdminMissing, AdminOrders, AdminProductForm, AdminProducts, AdminSettings, AdminShell } from './pages/admin'
import { AdminCategories, AdminClub, AdminServices, AdminStaff } from './pages/admin-ops'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/p/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/track/:id" element={<TrackPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route path="/staff" element={<Navigate to="/account?role=staff" replace />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="club" element={<AdminClub />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="*" element={<AdminMissing />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
