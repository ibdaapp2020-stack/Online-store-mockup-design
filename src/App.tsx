import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { firebaseEnvError } from './lib/firebase/config'
import { isPortal, portalUrl } from './lib/surface'
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
import { AdminDashboard, AdminDenied, AdminLogin, AdminMissing, AdminOrders, AdminProductForm, AdminProducts, AdminSettings, AdminShell } from './pages/admin'
import { AdminCategories, AdminClub, AdminServices, AdminStaff } from './pages/admin-ops'

function FirebaseGate({ children }: { children: ReactNode }) {
  const missing = firebaseEnvError()
  if (!missing) return children
  return (
    <main className="admin-login">
      <section className="panel">
        <h1>FIREBASE_CONFIG_MISSING</h1>
        {missing.missing.map((key) => (
          <p key={key}>{key}</p>
        ))}
      </section>
    </main>
  )
}

function StoreAdminRedirect() {
  useEffect(() => {
    window.location.replace(portalUrl('/'))
  }, [])
  return <p className="admin-wait">מעביר לפורטל הניהול...</p>
}

function PortalRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/denied" element={<AdminDenied />} />
      <Route path="/" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id" element={<AdminProductForm />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="customers" element={<AdminClub />} />
        <Route path="club" element={<Navigate to="/customers" replace />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="*" element={<AdminMissing />} />
      </Route>
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function StoreRoutes() {
  return (
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
      <Route path="/admin/*" element={<StoreAdminRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const portal = isPortal()
  return (
    <FirebaseGate>
      <StoreProvider>
        <BrowserRouter>{portal ? <PortalRoutes /> : <StoreRoutes />}</BrowserRouter>
      </StoreProvider>
    </FirebaseGate>
  )
}
