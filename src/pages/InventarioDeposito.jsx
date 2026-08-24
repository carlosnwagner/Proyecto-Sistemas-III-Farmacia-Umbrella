import { useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Search, ArrowLeft, PackageMinus } from "lucide-react";

// Componente para la barra de capacidad/stock
function VialGauge({ current, minimum, maxCapacity = 1000 }) {
  // Calculamos el porcentaje basado en una capacidad máxima estimada
  const percentage = Math.min(100, Math.max(0, (current / maxCapacity) * 100));

  // Lógica de colores según el stock mínimo
  let fillColor = "#22c55e"; // Verde (Normal)
  if (current === 0) fillColor = "#ef4444"; // Rojo (Sin stock)
  else if (current <= minimum) fillColor = "#f59e0b"; // Naranja (Stock Bajo)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div
        style={{
          width: "60px",
          height: "8px",
          backgroundColor: "#e5e7eb",
          borderRadius: "9999px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: fillColor,
            borderRadius: "9999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
        {current}
      </span>
    </div>
  );
}

// Componente para las etiquetas de estado
function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#dcfce7", color: "#166534" },
    warning: { backgroundColor: "#fef3c7", color: "#92400e" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  };

  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "700",
        display: "inline-flex",
        alignItems: "center",
        textTransform: "uppercase",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

// Componente para las tarjetas superiores
function StatCard({ title, value, subtitle, alert }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid #f3f4f6",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" }}>
          {title}
        </div>
        <div style={{ fontSize: "1.875rem", fontWeight: "700", color: alert ? "#dc2626" : "#221C16", margin: "0.25rem 0" }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: "0.875rem", color: alert ? "#dc2626" : "#7D756D", fontWeight: alert ? "600" : "400" }}>
        {subtitle}
      </div>
    </div>
  );
}

// COMPONENTE PRINCIPAL
// Recibe "onBack" por props para simular la navegación hacia atrás
export default function InventarioDeposito({ onBack = () => alert("Volver a depósitos") }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Información del depósito actual (Simulado)
  const [depositoInfo] = useState({
    codigo: "DEP-001",
    descripcion: "Depósito Central Planta Baja"
  });

  // Datos simulados de los artículos ASOCIADOS a este depósito
  const [inventory, setInventory] = useState([
    { id_relacion: 1, codigo: "ART-101", nombre: "Paracetamol 500mg", categoria: "Analgésicos", stock_actual: 850, stock_minimo: 200, estado: "Activo" },
    { id_relacion: 2, codigo: "ART-102", nombre: "Ibuprofeno 400mg", categoria: "Analgésicos", stock_actual: 150, stock_minimo: 300, estado: "Activo" }, // Stock Bajo
    { id_relacion: 3, codigo: "ART-103", nombre: "Amoxicilina 500mg", categoria: "Antibióticos", stock_actual: 0, stock_minimo: 100, estado: "Inactivo" }, // Sin stock
    { id_relacion: 4, codigo: "ART-104", nombre: "Omeprazol 20mg", categoria: "Gástricos", stock_actual: 400, stock_minimo: 100, estado: "Activo" }
  ]);

  // Estados del Modal de Edición (Generalmente aquí solo se edita el stock mínimo o estado)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const editFields = [
    { key: "codigo", label: "Código", readOnly: true },
    { key: "nombre", label: "Producto", readOnly: true },
    { key: "stock_minimo", label: "Stock Mínimo Permitido", type: "number" },
    { key: "estado", label: "Estado de la Asociación", type: "select", options: [{ value: "Activo", label: "Activo" }, { value: "Inactivo", label: "Inactivo" }] },
  ];

  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = (formData) => {
    setInventory((prev) =>
      prev.map((item) => (item.id_relacion === formData.id_relacion ? { ...item, ...formData, stock_minimo: Number(formData.stock_minimo) } : item))
    );
    setIsModalOpen(false);
  };

  // Lógica de Filtros y Estadísticas
  const categories = useMemo(() => {
    const cats = new Set(inventory.map((p) => p.categoria).filter(Boolean));
    return ["Todas", ...Array.from(cats)];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((p) => {
      const matchesSearch = p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const total = inventory.length;
    const stockBajo = inventory.filter((p) => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length;
    const sinStock = inventory.filter((p) => p.stock_actual === 0).length;
    const itemsSaludables = total - stockBajo - sinStock;

    return { total, stockBajo, sinStock, itemsSaludables };
  }, [inventory]);

  // Configuración de la Tabla
  const columns = [
    { header: "CÓDIGO", accessor: "codigo" },
    { header: "PRODUCTO", render: (p) => <span style={{ fontWeight: "600", color: "#221C16" }}>{p.nombre}</span> },
    { header: "CATEGORÍA", accessor: "categoria" },
    {
      header: "STOCK ACTUAL",
      render: (p) => (
        <VialGauge current={p.stock_actual} minimum={p.stock_minimo} maxCapacity={1000} />
      ),
    },
    { header: "STOCK MÍNIMO", render: (p) => <span style={{ color: "#7D756D", fontWeight: "600" }}>{p.stock_minimo}</span> },
    {
      header: "ESTADO",
      render: (p) => {
        let variant = "default";
        let label = p.estado;
        
        if (p.estado === "Inactivo") variant = "danger";
        else if (p.stock_actual === 0) { variant = "danger"; label = "Sin Stock"; }
        else if (p.stock_actual <= p.stock_minimo) { variant = "warning"; label = "Stock Bajo"; }
        else variant = "success";

        return <Badge variant={variant}>{label}</Badge>;
      },
    }
  ];

  return (
    <div style={{ padding: "1rem", backgroundColor: "#F7F4EE", minHeight: "100vh" }}>
      
      {/* Botón de regreso */}
      <button 
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "transparent", border: "none", color: "#65482b", fontWeight: "600", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}
      >
        <ArrowLeft size={18} /> Volver a Depósitos
      </button>

      {/* Encabezado */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            Inventario: {depositoInfo.codigo}
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            {depositoInfo.descripcion} — {stats.total} productos asociados
          </p>
        </div>
        
        {/* Aquí podrías agregar un botón para movimientos rápidos o auditorías si lo necesitas */}
        <button style={{ backgroundColor: "#ffffff", color: "#65482b", border: "1px solid #d1d5db", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <PackageMinus size={18} /> Ajuste de Stock
        </button>
      </header>

      {/* Tarjetas de Resumen (StatCards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard title="PRODUCTOS ASOCIADOS" value={stats.total} subtitle="Total en catálogo" />
        <StatCard title="STOCK SALUDABLE" value={stats.itemsSaludables} subtitle="Por encima del mínimo" />
        <StatCard title="STOCK BAJO" value={stats.stockBajo} subtitle="Requieren reposición" alert={stats.stockBajo > 0} />
        <StatCard title="SIN STOCK (QUIEBRE)" value={stats.sinStock} subtitle="Agotados completamente" alert={stats.sinStock > 0} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por producto o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", outline: "none", color: "#374151", fontWeight: "500" }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Tabla Modularizada (Reutilizando tu DataTable) */}
      <DataTable columns={columns} data={filteredInventory} onEdit={handleOpenEdit} />

      {/* Modal para Editar Parámetros del Stock */}
      <EditModal
        key={selectedItem ? selectedItem.id_relacion : "editar-stock"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        title="Modificar Parámetros de Stock"
        fields={editFields}
        initialData={selectedItem}
      />
    </div>
  );
}