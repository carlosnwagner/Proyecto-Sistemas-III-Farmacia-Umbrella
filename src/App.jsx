import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/MainLayout.jsx";
import Inventario from "./pages/InventarioProductos.jsx";
import Proveedores from "./pages/Proveedores.jsx";
import RegistarPagoProveedor from "./pages/RegistrarPagoProveedor.jsx";
import RegistarNotaCreditoDebito from "./pages/RegistrarNotaCreditoDebito.jsx";
import Sucursales from "./pages/Sucursales.jsx";
  
import Depositos from "./pages/Depositos.jsx";
import OrdenesCompra from "./pages/OrdenesCompra.jsx";
import FacturasProveedores from "./pages/FacturasProveedores.jsx";

function PaginaEnConstruccion({ titulo }) {
  return (
    <div>
      <h1 style={{ fontSize: "1.875rem", fontWeight: "700", color: "#111827" }}>
        {titulo}
      </h1>
      <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
        Sección en desarrollo.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/inventario" replace />} />
          <Route path="/inicio" element={<PaginaEnConstruccion titulo="Inicio" />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/ordenes-compra" element={<OrdenesCompra />} />
          <Route path="/facturas-proveedores" element={<FacturasProveedores />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/pagos-proveedores" element={<RegistarPagoProveedor titulo="Pago Proveedor" />} />
          <Route path="/notas-credito-debito" element={<RegistarNotaCreditoDebito titulo="Notas Crédito/Débito" />} />
          <Route path="/sucursales" element={<Sucursales />} />
          <Route path="/depositos" element={<Depositos />} />
          <Route path="/ventas" element={<PaginaEnConstruccion titulo="Ventas" />} />
          <Route path="/reportes" element={<PaginaEnConstruccion titulo="Reportes" />} />
          <Route path="/configuracion" element={<PaginaEnConstruccion titulo="Configuración" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}