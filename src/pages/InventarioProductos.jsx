import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx"; // 1. Importamos el modal
import { Search, Plus } from "lucide-react";
import { supabase } from '../lib/supabase.js'

// Servicios backend
import { createArticulo } from '../services/articulos.js';
import { getRubros, getUnidadesMedida } from '../services/catalogos.js';

// --------------------- Componentes UI ------------------------
function VialGauge({ current, total, status }) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  let fillColor = "#22c55e";
  if (status === "crítico") fillColor = "#ef4444";
  else if (status === "bajo") fillColor = "#f59e0b";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div
        style={{
          width: "48px",
          height: "12px",
          backgroundColor: "#e5e7eb",
          borderRadius: "9999px",
          overflow: "hidden",
          position: "relative",
          border: "1px solid #d1d5db",
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
        {current ? current.toLocaleString() : 0}
      </span>
    </div>
  );
}

function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#dcfce7", color: "#166534" },
    warning: { backgroundColor: "#fef3c7", color: "#92400e" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
    info: { backgroundColor: "#e0f2fe", color: "#075985" },
  };

  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "600",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

// ------------------- Fin Componentes UI ------------------------

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
        <div style={{ fontSize: "1.875rem", fontWeight: "700", color: alert ? "#dc2626" : "#111827", margin: "0.25rem 0" }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: "0.875rem", color: alert ? "#dc2626" : "#6b7280" }}>
        {subtitle}
      </div>
    </div>
  );
}

export default function InventarioMedicamentos() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // 2. Estados para controlar el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Lectura de productos desde bd
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // NOTA: Cambiá 'productos' por el nombre real de tu tabla si es distinto
    const { data, error } = await supabase.from('articulo').select('*');
    if (error) {
      console.error("Error al traer datos:", error);
    } else {
      setProducts(data || []);
    }
  };

  // Campos para el formulario dinámico del Modal
  const editFields = [
    { key: "codigo", label: "Código / ID" },
    { key: "codigo_barras", label: "Código de Barras" },
    { key: "nombre", label: "Nombre del Producto" },
    { key: "descripcion", label: "Descripción" },
    { key: "lote", label: "Lote" },
    { key: "categoria", label: "Categoría" },
    { key: "unidad", label: "Unidad (ej. Kg, U)" },
    { key: "stock", label: "Stock Inicial", type: "number" },
    { key: "costo", label: "Costo", type: "number" },
    { key: "precio_venta", label: "Precio de Venta", type: "number" },
    { key: "fechaVencimiento", label: "Fecha de Vencimiento", type: "date" },
    { key: "sucursal", label: "Sucursal" },
  ];

  // Funciones de apertura
  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Guardar datos
  const handleSaveProduct = (formData) => {
    if (selectedProduct) {
      setProducts((prev) =>
        prev.map((item) => (item === selectedProduct ? formData : item))
      );
    } else {
      const newEntry = {
        ...formData,
        stock: Number(formData.stock) || 0,
        precio: Number(formData.precio) || 0,
        diasVencimiento: 120, // Valor de prueba predeterminado
        estadoStock: "normal",
      };
      setProducts((prev) => [...prev, newEntry]);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.categoria).filter(Boolean));
    return ["Todas", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.lote?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "Todas" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const total = products.length;
    const stockBajo = products.filter((p) => p.estadoStock === "bajo" || p.estadoStock === "crítico").length;
    const proximosVencer = products.filter((p) => p.diasVencimiento <= 90).length;
    const valorTotal = products.reduce((acc, p) => acc + (p.precio || 0) * (p.stock || 0), 0);

    return { total, stockBajo, proximosVencer, valorTotal };
  }, [products]);

  const columns = [
    { header: "ID", accessor: "codigo" },
    { header: "NOMBRE", render: (p) => <span style={{ fontWeight: "600" }}>{p.nombre}</span> },
    { header: "DESCRIPCIÓN", accessor: "descripcion" },
    { header: "LOTE", accessor: "lote" },
    { header: "ESTADO", accessor: "estado" },
    {
      header: "STOCK",
      render: (p) => (
        <VialGauge current={p.stock} total={p.stockMaximo || 5000} status={p.estadoStock} />
      ),
    },
    {
      header: "VENCIMIENTO",
      render: (p) => (
        <Badge variant={p.diasVencimiento <= 90 ? "warning" : "success"}>
          {p.fechaVencimiento}
        </Badge>
      ),
    },
    { header: "PRECIO", render: (p) => <span style={{ fontWeight: "600" }}>${p.precio}</span> },
    { header: "SUCURSAL", accessor: "sucursal" },
  ];

  return (
    <>
      {/* Encabezado */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            Inventario
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            {stats.total} productos registrados
          </p>
        </div>
        <button
          onClick={handleOpenCreate} // 3. Se asignó la función onClick al botón
          style={{
            backgroundColor: "#65482b",
            color: "#ffffff",
            border: "none",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
          }}
        >
          <Plus size={18} /> Nuevo producto
        </button>
      </header>

      {/* Tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard title="PRODUCTOS ACTIVOS" value={stats.total} subtitle="En categorías" />
        <StatCard title="STOCK BAJO / CRÍTICO" value={stats.stockBajo} subtitle="Requieren reposición" alert={stats.stockBajo > 0} />
        <StatCard title="PRÓXIMOS A VENCER" value={stats.proximosVencer} subtitle="En 90 días o menos" alert={stats.proximosVencer > 0} />
        <StatCard title="VALOR EN INVENTARIO" value={`$${stats.valorTotal.toLocaleString()}`} subtitle="Precio de lista" />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por nombre, código, lote..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.625rem 0.625rem 0.625rem 2.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: "0.625rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            outline: "none",
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Tabla Modularizada */}
      <DataTable columns={columns} data={filteredProducts} onEdit={handleOpenEdit} />

      {/* 4. Render del EditModal */}
      <EditModal
        key={selectedProduct ? selectedProduct.codigo : "nuevo-producto"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        title={selectedProduct ? "Editar Producto" : "Nuevo Producto"}
        fields={editFields}
        initialData={selectedProduct}
      />
    </>
  );
}