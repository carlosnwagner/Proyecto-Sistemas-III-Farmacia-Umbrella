import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/MainLayout.jsx";
import Inventario from "./pages/InventarioProductos.jsx";
import Proveedores from "./pages/Proveedores.jsx";
import RegistarPagoProveedor from "./pages/RegistrarPagoProveedor.jsx";
import RegistarNotaCreditoDebito from "./pages/RegistrarNotaCreditoDebito.jsx";
import Sucursales from "./pages/Sucursales.jsx";
import Depositos from "./pages/Depositos.jsx";
import FacturasProveedores from "./pages/FacturasProveedores.jsx";
import OrdenesCompra from "./pages/OrdenesCompraProv.jsx";
import InventarioDeposito from "./pages/InventarioDeposito.jsx";
import RegistrarVenta from "./pages/RegistrarVenta.jsx";
import ListasPrecios from "./pages/ListasPrecios.jsx";
import ClientesVentas from "./pages/ClientesVentas.jsx";
import AperturaCaja from "./pages/AperturaCaja.jsx";
import TurnosCaja from "./pages/TurnosCaja.jsx";
import MovimientosCaja from "./pages/MovimientosCaja.jsx";
import ArqueoCaja from "./pages/ArqueoCaja.jsx";
import CierreCaja from "./pages/CierreCaja.jsx";
import Login from "./pages/login.jsx";
import { AuthProvider, ProtectedRoute, RoleRoute, HomeRedirect } from "./context/AuthContext.jsx";
import { ROLES } from "./config/roles.js";

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
      <AuthProvider>
        <Routes>
          {/* Ruta pública de Login y Registro */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas del Sistema */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomeRedirect />} />

            {/* ── Cualquier usuario autenticado (incluye "pendiente") ── */}
            <Route path="/inicio" element={<PaginaEnConstruccion titulo="Inicio" />} />

            {/* ── CAJERO (el administrador también entra, ver ROLES_SUPERUSUARIO) ── */}
            <Route element={<RoleRoute allowedRoles={[ROLES.CAJERO]} />}>
              {/* Módulo de Caja (Sprint 4 - HU49) */}
              <Route path="/caja" element={<AperturaCaja />} />
              <Route path="/caja/arqueo" element={<ArqueoCaja />} />
              <Route path="/caja/cierre" element={<CierreCaja />} />
              <Route path="/caja/movimientos" element={<MovimientosCaja key="real" />} />
              <Route path="/cajas" element={<Navigate to="/caja" replace />} />
              <Route path="/turnos-caja" element={<TurnosCaja />} />
              <Route path="/configuracion" element={<PaginaEnConstruccion titulo="Configuración" />} />
            </Route>

            {/* ── SOLO ADMINISTRADOR ── */}
            <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
              {import.meta.env.DEV && <Route path="/demo/hu50" element={<MovimientosCaja key="demo" demo />} />}
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/ordenes-compra" element={<OrdenesCompra />} />
              <Route path="/facturas-proveedores" element={<FacturasProveedores />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/pagos-proveedores" element={<RegistarPagoProveedor titulo="Pago Proveedor" />} />
              <Route path="/notas-credito-debito" element={<RegistarNotaCreditoDebito titulo="Notas Crédito/Débito" />} />
              <Route path="/sucursales" element={<Sucursales />} />
              <Route path="/depositos" element={<Depositos />} />
              {/* Soportamos ambos formatos para que nunca falle la ruta */}
              <Route path="/depositos/:id/inventario" element={<InventarioDeposito />} />
              <Route path="/inventario-deposito" element={<InventarioDeposito />} />
              <Route path="/ventas" element={<RegistrarVenta />} />
              <Route path="/listas-precios" element={<ListasPrecios />} />
              <Route path="/clientes" element={<ClientesVentas />} />
              <Route path="/reportes" element={<PaginaEnConstruccion titulo="Reportes" />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}