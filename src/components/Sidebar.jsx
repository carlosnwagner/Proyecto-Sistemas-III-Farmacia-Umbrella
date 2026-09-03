import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Package,
  ClipboardList,
  Truck,
  BarChart3,
  Globe,
  MapPin,
  Settings,
  Warehouse,
  FileText,
} from "lucide-react";

export default function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  
  // Obtenemos la ruta real en la que está la app
  const location = useLocation();

  // 2. Corregimos las rutas (path)
  const menuItems = [
    { key: "Inicio", label: "Inicio", path: "/inicio", icon: Home },
    { key: "Inventario", label: "Inventario", path: "/inventario", icon: Package },
  { key: "OrdenesCompra", label: "Órdenes de compra", path: "/ordenes-compra", icon: ClipboardList },
    { key: "Facturas", label: "Facturas de proveedores", path: "/facturas-proveedores", icon: FileText },
    { key: "Proveedores", label: "Proveedores", path: "/proveedores", icon: Truck },
    { key: "Pagos", label: "Pagos a Proveedores", path: "/pagos-proveedores", icon: Truck },
    { key: "Notas", label: "Notas Crédito/Débito", path: "/notas-credito-debito", icon: ClipboardList },
    { key: "Sucursales", label: "Sucursales", path: "/sucursales", icon: MapPin },
    { key: "Depositos", label: "Depósitos", path: "/depositos", icon: Warehouse },
    { key: "Ventas", label: "Ventas", path: "/ventas", icon: Globe },
    { key: "reportes", label: "Reportes", path: "/reportes", icon: BarChart3 },
  ];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredButton(null);
      }}
      style={{
        width: isHovered ? "200px" : "72px",
        backgroundColor: "#2d241e",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        padding: "1rem 0.75rem",
        height: "100vh",
        position: "sticky",
        top: 0,
        flexShrink: 0,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        boxSizing: "border-box",
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          paddingLeft: "0.25rem",
        }}
      >
        <div
          style={{
            padding: "0.4rem",
            backgroundColor: "#3f332a",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img 
            src="/Umbrellafarmacia.svg" 
            alt="Umbrella Farmacia" 
            style={{ width: "32px", height: "32px", objectFit: "contain" }} 
         />
        </div>
        <span
          style={{
            fontWeight: "700",
            fontSize: "0.95rem",
            color: "#ffffff",
            lineHeight: "1.2",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        >
          Farmacia<br />Umbrella
        </span>
      </div>

      {/* Menú de Navegación */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          flex: 1,
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          
          // 3. Verifica si la URL actual coincide exactamente con el path
          const isActive = location.pathname === item.path;
          const isItemHovered = hoveredButton === item.key;

          let bg = "transparent";
          if (isActive) bg = "#4a3c32";
          else if (isItemHovered) bg = "rgba(255, 255, 255, 0.08)";

          return (
            <Link
              key={item.key}
              to={item.path}
              title={!isHovered ? item.label : ""}
              onMouseEnter={() => setHoveredButton(item.key)}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "0.5rem",
                textDecoration: "none",
                backgroundColor: bg,
                color: isActive ? "#ffffff" : isItemHovered ? "#e5e7eb" : "#9ca3af",
                display: "flex",
                alignItems: "center",
                padding: "0 0.75rem",
                gap: "0.85rem",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s ease",
                boxSizing: "border-box",
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "15%",
                    height: "70%",
                    width: "4px",
                    backgroundColor: "#84cc16",
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  color: isActive ? "#84cc16" : isItemHovered ? "#ffffff" : "inherit",
                  transition: "color 0.2s ease",
                }}
              >
                <Icon size={20} />
              </div>
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: isActive ? "600" : "400",
                  whiteSpace: "nowrap",
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Configuración */}
      <div
        style={{
          borderTop: "1px solid #3f332a",
          paddingTop: "0.75rem",
        }}
      >
        <Link
          to="/configuracion"
          title={!isHovered ? "Configuración" : ""}
          onMouseEnter={() => setHoveredButton("settings")}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            width: "100%",
            height: "44px",
            borderRadius: "0.5rem",
            textDecoration: "none",
            backgroundColor: location.pathname === "/configuracion" ? "#4a3c32" : hoveredButton === "settings" ? "rgba(255, 255, 255, 0.08)" : "transparent",
            color: location.pathname === "/configuracion" || hoveredButton === "settings" ? "#ffffff" : "#9ca3af",
            display: "flex",
            alignItems: "center",
            padding: "0 0.75rem",
            gap: "0.85rem",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <Settings size={20} />
          </div>
          <span
            style={{
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              opacity: isHovered ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          >
            Configuración
          </span>
        </Link>
      </div>
    </aside>
  );
}