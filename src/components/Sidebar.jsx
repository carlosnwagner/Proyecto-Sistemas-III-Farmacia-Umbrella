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
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
} from "lucide-react";

export default function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [comprasOpen, setComprasOpen] = useState(false);

  const location = useLocation();

  // Submenú de Compras
  const comprasSubItems = [
    { key: "Proveedores", label: "Proveedores", path: "/proveedores", icon: Truck },
    { key: "OrdenesCompra", label: "Orden de compra", path: "/ordenes-compra", icon: ClipboardList },
    { key: "Pagos", label: "Pagos a Proveedores", path: "/pagos-proveedores", icon: Receipt },
    { key: "Notas", label: "Notas Crédito/Débito", path: "/notas-credito-debito", icon: FileText },
  ];

  // Elementos principales
  const menuItems = [
    { key: "Inicio", label: "Inicio", path: "/inicio", icon: Home },
    { key: "Inventario", label: "Inventario", path: "/inventario", icon: Package },
    { key: "Sucursales", label: "Sucursales", path: "/sucursales", icon: MapPin },
    { key: "Depositos", label: "Depósitos", path: "/depositos", icon: Warehouse },
    { key: "Ventas", label: "Ventas", path: "/ventas", icon: Globe },
    { key: "reportes", label: "Reportes", path: "/reportes", icon: BarChart3 },
  ];

  const isComprasActive = comprasSubItems.some((sub) => location.pathname === sub.path);

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredButton(null);
      }}
      style={{
        width: isHovered ? "220px" : "72px",
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
        overflowX: "hidden",
        overflowY: "auto",
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
            whiteSpace: "nowrap",
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
        {/* Inicio & Inventario */}
        {menuItems.slice(0, 2).map((item) => renderNavLink(item))}

        {/* MÓDULO AGRUPADO: COMPRAS */}
        <div>
          <button
            onClick={() => {
              if (isHovered) setComprasOpen(!comprasOpen);
            }}
            title={!isHovered ? "Compras" : ""}
            onMouseEnter={() => setHoveredButton("ComprasGroup")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: isComprasActive
                ? "#4a3c32"
                : hoveredButton === "ComprasGroup"
                ? "rgba(255, 255, 255, 0.08)"
                : "transparent",
              color: isComprasActive ? "#ffffff" : hoveredButton === "ComprasGroup" ? "#e5e7eb" : "#9ca3af",
              display: "flex",
              alignItems: "center",
              padding: "0 0.75rem",
              justifyContent: "space-between",
              cursor: "pointer",
              position: "relative",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
            }}
          >
            {isComprasActive && (
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

            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  color: isComprasActive ? "#84cc16" : hoveredButton === "ComprasGroup" ? "#ffffff" : "inherit",
                }}
              >
                <Truck size={20} />
              </div>
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: isComprasActive ? "600" : "400",
                  whiteSpace: "nowrap",
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                Compras
              </span>
            </div>

            {isHovered && (
              <div style={{ display: "flex", alignItems: "center", color: "#9ca3af" }}>
                {comprasOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            )}
          </button>

          {/* Submenú desplegable de Compras */}
          {comprasOpen && isHovered && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                paddingLeft: "1.25rem",
                marginTop: "0.35rem",
              }}
            >
              {comprasSubItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = location.pathname === sub.path;
                const isSubHovered = hoveredButton === sub.key;

                return (
                  <Link
                    key={sub.key}
                    to={sub.path}
                    onMouseEnter={() => setHoveredButton(sub.key)}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      width: "100%",
                      height: "38px",
                      borderRadius: "0.375rem",
                      textDecoration: "none",
                      backgroundColor: isSubActive
                        ? "rgba(132, 204, 22, 0.15)"
                        : isSubHovered
                        ? "rgba(255, 255, 255, 0.05)"
                        : "transparent",
                      color: isSubActive ? "#84cc16" : isSubHovered ? "#ffffff" : "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 0.6rem",
                      gap: "0.65rem",
                      transition: "all 0.2s ease",
                      boxSizing: "border-box",
                    }}
                  >
                    <SubIcon size={16} />
                    <span
                      style={{
                        fontSize: "0.825rem",
                        fontWeight: isSubActive ? "600" : "400",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sub.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Resto de Secciones */}
        {menuItems.slice(2).map((item) => renderNavLink(item))}
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
            backgroundColor:
              location.pathname === "/configuracion"
                ? "#4a3c32"
                : hoveredButton === "settings"
                ? "rgba(255, 255, 255, 0.08)"
                : "transparent",
            color:
              location.pathname === "/configuracion" || hoveredButton === "settings"
                ? "#ffffff"
                : "#9ca3af",
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

  // Helper para renderizar los ítems principales
  function renderNavLink(item) {
    const Icon = item.icon;
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
  }
}