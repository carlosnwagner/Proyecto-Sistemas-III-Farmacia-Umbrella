import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

export default function MainLayout() {
  const location = useLocation();

  // Mapeo de la ruta actual a la key de tu Sidebar.jsx
  const getActiveKey = (path) => {
    if (path.startsWith("/inicio")) return "Inicio";
    if (path.startsWith("/inventario")) return "Inventario";
    if (path.startsWith("/ordenes-compra")) return "OrdenesCompra";
    if (path.startsWith("/facturas-proveedores")) return "Facturas";
    if (path.startsWith("/proveedores")) return "Proveedores";
    if (path.startsWith("/pagos-proveedores")) return "Pagos";
    if (path.startsWith("/notas-credito-debito")) return "Notas";
    if (path.startsWith("/sucursales")) return "Sucursales";
    if (path.startsWith("/ventas")) return "Ventas";
    if (path.startsWith("/reportes")) return "reportes";
    return "Inventario";
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
      <Sidebar activeItem={getActiveKey(location.pathname)} />
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

