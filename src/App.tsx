import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Admin } from './pages/Admin'
import { CartPage } from './pages/Cart'
import { Catalog } from './pages/Catalog'
import { Checkout } from './pages/Checkout'
import { Gate } from './pages/Gate'
import { Home } from './pages/Home'
import { ProductPage } from './pages/Product'
import { Thanks } from './pages/Thanks'
import { BusinessAccess } from './pages/Business'
import { InvoicePage } from './pages/Invoice'
import { Club } from './pages/Club'
import { Lab } from './pages/Lab'
import { StoreProvider } from './store'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Gate />} />
          <Route element={<Shell />}>
            <Route path="/shop" element={<Home />} />
            <Route path="/c/:cat" element={<Catalog />} />
            <Route path="/p/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/thanks/:id" element={<Thanks />} />
            <Route path="/b2b" element={<BusinessAccess />} />
            <Route path="/club" element={<Club />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/invoice/:id" element={<InvoicePage />} />
          </Route>
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
