import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Search, ArrowLeft, PackageMinus } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js";

// Componente para la barra de capacidad/stock
function VialGauge({ current, minimum, maxCapacity = 1000 }) {
  const percentage = Math.min(100, Math.max(0, (current / maxCapacity) * 100));

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
        justifyIn: "space-between",
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
export default function InventarioDeposito({ deposito, onBack }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [inventory, setInventory] = useState([]);
  const [availableArticles, setAvailableArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const depositoId = deposito?.id_deposito;

  const fetchInventory = useCallback(async () => {
    if (!depositoId) return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("articulopordeposito")
      .select(`
        id_articulo_deposito,
        id_articulo,
        stock_actual,
        stock_minimo,
        estado,
        articulo:id_articulo ( codigo, nombre )
      `)
      .eq("id_deposito", depositoId)
      .order("id_articulo_deposito", { ascending: true });

    if (fetchError) {
      setError("No se pudo cargar el inventario del depósito.");
      setInventory([]);
    } else {
      setInventory((data || []).map((item) => ({
        ...item,
        codigo: item.articulo?.codigo,
        nombre: item.articulo?.nombre,
        categoria: item.articulo?.categoria || "Sin categoría",
        estado: item.estado === true || item.estado === "true" ? "Activo" : "Inactivo",
      })));
    }

    setLoading(false);
  }, [depositoId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  async function openStockAdjustment() {
    const { data, error: articlesError } = await supabase
      .from("articulo")
      .select("id_articulo, codigo, nombre")
      .eq("estado", true)
      .order("nombre", { ascending: true });

    if (articlesError) {
      showAlert.errorSave("No se pudieron cargar los productos: " + articlesError.message);
      return;
    }

    const associatedIds = new Set(inventory.map((item) => item.id_articulo));
    setAvailableArticles((data || []).filter((article) => !associatedIds.has(article.id_articulo)));
    setSelectedItem({ id_articulo: "", stock_actual: 0, stock_minimo: 10 });
    setIsModalOpen(true);
  }

  const adjustmentFields = [
    { key: "id_articulo", label: "Producto", type: "select", options: availableArticles.map((article) => ({ value: String(article.id_articulo), label: `[${article.codigo}] ${article.nombre}` })) },
    { key: "stock_actual", label: "Stock Inicial", type: "number" },
    { key: "stock_minimo", label: "Stock Mínimo Permitido", type: "number" },
  ];

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

  const handleSaveItem = async (formData) => {
    const isEditing = Boolean(formData.id_articulo_deposito);

    if (!isEditing) {
      // Lógica de Creación / Ajuste inicial
      const stockInicial = Number(formData.stock_actual) || 0;
      const { data: association, error: insertError } = await supabase
        .from("articulopordeposito")
        .insert({
          id_articulo: Number(formData.id_articulo),
          id_deposito: deposito.id_deposito,
          stock_actual: stockInicial,
          stock_minimo: Number(formData.stock_minimo) || 0,
          estado: true,
          fecha_registro: new Date().toISOString(),
        })
        .select("id_articulo_deposito")
        .single();

      if (insertError) {
        showAlert.errorSave("Error al registrar el ajuste");
        return false;
      }

      if (stockInicial > 0) {
        await supabase.from("movimientostock").insert({
          id_articulo_deposito: association.id_articulo_deposito,
          id_lote: null,
          tipo_movimiento: "INGRESO_INICIAL",
          cantidad: stockInicial,
          fecha_movimiento: new Date().toISOString(),
        });
      }

      // Alerta modal centrada con SweetAlert2 para creación
      showAlert.successSave("¡Ajuste de stock registrado con éxito!");
      await fetchInventory();
      return true;
    }

    // Lógica de Edición
    const { error: updateError } = await supabase
      .from("articulopordeposito")
      .update({
        stock_minimo: Number(formData.stock_minimo) || 0,
        estado: formData.estado === "Activo",
      })
      .eq("id_articulo_deposito", formData.id_articulo_deposito);

    if (updateError) {
      showAlert.errorSave("Error al actualizar el registro");
      return false;
    }

    // Alerta modal centrada con SweetAlert2 para edición
    showAlert.successSave("¡Parámetros de stock actualizados con éxito!");
    
    setInventory((prev) =>
      prev.map((item) =>
        item.id_articulo_deposito === formData.id_articulo_deposito
          ? { ...item, ...formData, stock_minimo: Number(formData.stock_minimo) }
          : item
      )
    );
    return true;
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
        let variant;
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
            Inventario: {deposito?.codigo}
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            {deposito?.descripcion} — {stats.total} productos asociados
          </p>
        </div>
        
        <button onClick={openStockAdjustment} style={{ backgroundColor: "#ffffff", color: "#65482b", border: "1px solid #d1d5db", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
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

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Cargando inventario del depósito...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#991b1b" }}>{error}</div>
      ) : (
        <DataTable columns={columns} data={filteredInventory} onEdit={handleOpenEdit} />
      )}

      {/* Modal para Editar Parámetros del Stock */}
      <EditModal
        key={selectedItem ? (selectedItem.id_articulo_deposito || "nuevo") : "editar-stock"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        title={selectedItem?.id_articulo_deposito ? "Modificar Parámetros de Stock" : "Ajuste de Stock"}
        fields={selectedItem?.id_articulo_deposito ? editFields : adjustmentFields}
        initialData={selectedItem}
      />
    </div>
  );
}