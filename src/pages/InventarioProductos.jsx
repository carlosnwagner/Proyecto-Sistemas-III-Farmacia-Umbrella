import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Search, Plus } from "lucide-react";
import { supabase } from '../lib/supabase.js';
import { showAlert } from "../lib/alerts.js";

// Servicios backend
import { createArticulo, updateArticulo } from '../services/articulos.js';
import { getRubros, getUnidadesMedida } from '../services/catalogos.js';

// --------------------- Componentes UI ------------------------
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
// ------------------- Fin Componentes UI ------------------------

export default function InventarioProductos() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Estado local para notificaciones flotantes (Toasts)
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [rubros, setRubros] = useState([]);
  const [unidades, setUnidades] = useState([]);

  // Carga de datos inicial
  useEffect(() => {
    fetchProducts();
    cargarCatalogos();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('articulo').select('*');
    if (error) {
      console.error("Error al traer datos:", error);
    } else {
      setProducts(data || []);
    }
  };

  const cargarCatalogos = async () => {
    const { data: dataRubros } = await getRubros();
    const { data: dataUnidades } = await getUnidadesMedida();

    setRubros(dataRubros || []);
    setUnidades(dataUnidades || []);
  };

  // CAMPOS DE MODAL
  const editFields = useMemo(() => [
    { key: "codigo", label: "Código Interno" },
    { key: "codigo_barras", label: "Código de Barras" },
    { key: "nombre", label: "Nombre del Producto" },
    { key: "descripcion", label: "Descripción" },
    { 
      key: "id_rubro", 
      label: "Categoría / Rubro", 
      type: "select",
      options: rubros.map(r => ({ value: r.id_rubro, label: r.nombre })) 
    },
    { 
      key: "id_unidad", 
      label: "Unidad de Medida", 
      type: "select", 
      options: unidades.map(u => ({ value: u.id_unidad, label: u.nombre })) 
    },
    { key: "precio_costo", label: "Costo ($)", type: "number" },
    { key: "precio_venta", label: "Precio de Venta ($)", type: "number" },
    { 
      key: "estado", 
      label: "Estado", 
      type: "select", 
      options: [
        { value: true, label: "Activo" },
        { value: false, label: "Inactivo" }
      ] 
    }
  ], [rubros, unidades]);

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct({
      ...product,
      estado: Boolean(product.estado)
    });
    setIsModalOpen(true);
  };

  // GUARDADO DE DATOS CON VALIDACIONES Y ESTADO BOOLEANO ESTRICTO
  const handleSaveProduct = async (formData) => {
    if (!formData.codigo || formData.codigo.trim() === "") {
      alert("El código interno es obligatorio.");
      return;
    }

    if (formData.codigo_barras && !/^\d+$/.test(formData.codigo_barras)) {
      alert("El código de barras debe contener únicamente números.");
      return;
    }

    // Evaluación limpia y robusta del estado proveniente del modal
    let estadoBoolean = true;
    if (selectedProduct) {
      if (
        formData.estado === false || 
        formData.estado === "false" || 
        formData.estado === "Inactivo" || 
        formData.estado === 0 || 
        formData.estado === "0"
      ) {
        estadoBoolean = false;
      }
    }

    const payload = {
      id_rubro: Number(formData.id_rubro),
      id_unidad: Number(formData.id_unidad),
      codigo: formData.codigo.trim(),
      codigo_barras: formData.codigo_barras ? formData.codigo_barras.trim() : null,
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      precio_costo: Number(formData.precio_costo),
      precio_venta: Number(formData.precio_venta),
      estado: Boolean(selectedProduct ? estadoBoolean : true) // Forzamos booleano estricto aquí
    };
     if (selectedProduct) {
  // --- MODO EDICIÓN ---
  const { error } = await updateArticulo(selectedProduct.id_articulo, payload);

    if (selectedProduct) {
      const { error } = await updateArticulo(selectedProduct.id_articulo, payload);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("¡Producto actualizado con éxito!");
        fetchProducts();
        setIsModalOpen(false);
      }
    } else {
      const { error } = await createArticulo(payload);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("¡Producto registrado con éxito!");
        fetchProducts(); 
        setIsModalOpen(false); 
      }
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "Todas" || String(p.id_rubro) === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const total = products.length;
    const activos = products.filter(p => p.estado === true || p.estado === "Activo" || p.estado === 1).length;
    const valorTotal = products.reduce((acc, p) => acc + (Number(p.precio_costo) || 0), 0);
    return { total, activos, valorTotal };
  }, [products]);

  const columns = [
    { header: "CÓDIGO", accessor: "codigo" },
    { header: "C. BARRAS", accessor: "codigo_barras" },
    { header: "NOMBRE", render: (p) => <span style={{ fontWeight: "600" }}>{p.nombre}</span> },
    { header: "COSTO", render: (p) => <span>${p.precio_costo}</span> },
    { header: "PRECIO VENTA", render: (p) => <span style={{ fontWeight: "600", color: "#166534" }}>${p.precio_venta}</span> },
    {
      header: "ESTADO",
      render: (p) => {
        const isActivo = p.estado === true || p.estado === "Activo" || p.estado === 1;
        return (
          <Badge variant={isActivo ? "success" : "default"}>
            {isActivo ? "ACTIVO" : "INACTIVO"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Productos</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{stats.total} productos registrados</p>
        </div>
        <button onClick={handleOpenCreate} style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <Plus size={18} /> Nuevo producto
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard title="PRODUCTOS REGISTRADOS" value={stats.total} subtitle="Total histórico" />
        <StatCard title="PRODUCTOS ACTIVOS" value={stats.activos} subtitle="Disponibles" />
        <StatCard title="VALOR COSTO INVENTARIO" value={`$${stats.valorTotal.toLocaleString()}`} subtitle="Inversión total" />
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input type="text" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      <DataTable columns={columns} data={filteredProducts} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedProduct ? selectedProduct.codigo : "nuevo-producto"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        title={selectedProduct ? "Editar Producto" : "Nuevo Producto"}
        fields={selectedProduct ? editFields : editFields.filter(f => f.key !== "estado")}
        initialData={selectedProduct}
      />
    </div>
  );
}