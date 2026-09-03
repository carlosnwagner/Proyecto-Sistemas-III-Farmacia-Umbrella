import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Search, Plus } from "lucide-react";
import { supabase } from '../lib/supabase.js';
import { showAlert } from "../lib/alerts.js";

// Servicios backend
import { createArticulo, updateArticulo } from '../services/articulos.js';
import { getRubros, getUnidadesMedida } from '../services/catalogos.js';

const PREFIJOS_OPCIONES = [
  { value: "MED", label: "MED – Medicamentos" },
  { value: "PER", label: "PER – Perfumería" },
  { value: "ACC", label: "ACC – Accesorios" },
  { value: "DER", label: "DER – Dermocosmética" },
  { value: "HIG", label: "HIG – Higiene personal" },
  { value: "INF", label: "INF – Infantil" },
  { value: "NUT", label: "NUT – Nutrición" },
  { value: "ORT", label: "ORT – Ortopedia" },
  { value: "BUC", label: "BUC – Cuidado bucal" },
  { value: "SOL", label: "SOL – Protección solar" },
  { value: "MAQ", label: "MAQ – Maquillaje" },
  { value: "OPT", label: "OPT – Óptica" },
  { value: "DIET", label: "DIET – Dietética" },
  { value: "PA", label: "PA – Primeros auxilios" }
];

function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#dcfce7", color: "#166534" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" }
  };
  return (
    <span style={{ padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600", display: "inline-flex", alignItems: "center", ...styles[variant] }}>
      {children}
    </span>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f3f4f6", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: "1.875rem", fontWeight: "700", color: "#111827", margin: "0.25rem 0" }}>{value}</div>
      {subtitle && <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{subtitle}</div>}
    </div>
  );
}

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
  const [initialFormData, setInitialFormData] = useState(null);
  const [rubros, setRubros] = useState([]);
  const [unidades, setUnidades] = useState([]);

  useEffect(() => {
    fetchProducts();
    cargarCatalogos();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('articulo')
      .select('id_articulo, codigo, codigo_barras, nombre, descripcion, id_rubro, id_unidad, precio_costo, precio_venta, estado')
      .order('id_articulo', { ascending: false });
    if (data) setProducts(data);
  };

  const cargarCatalogos = async () => {
    const { data: dRubros } = await getRubros();
    const { data: dUnidades } = await getUnidadesMedida();
    setRubros(dRubros || []);
    setUnidades(dUnidades || []);
  };

  const getSiguienteCodigo = async (pref) => {
    const { data } = await supabase.from('articulo').select('codigo').ilike('codigo', `${pref}-%`);
    if (!data || data.length === 0) return `${pref}-001`;
    let maxNum = 0;
    data.forEach(item => {
      const parts = item.codigo?.split("-");
      if (parts && parts.length >= 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${pref}-${String(maxNum + 1).padStart(3, "0")}`;
  };

  const editFields = useMemo(() => {
    if (selectedProduct) {
      return [
        { key: "codigo", label: "Código Interno (Bloqueado)", readOnly: true },
        { key: "codigo_barras", label: "Código de Barras (Bloqueado)", readOnly: true },
        { key: "nombre", label: "Nombre del Producto *" },
        { key: "descripcion", label: "Descripción" },
        { key: "id_rubro", label: "Categoría", type: "select", options: rubros.map(r => ({ value: r.id_rubro, label: r.nombre })) },
        { key: "id_unidad", label: "Unidad", type: "select", options: unidades.map(u => ({ value: u.id_unidad, label: u.nombre })) },
        { key: "precio_costo", label: "Costo ($)", type: "number" },
        { key: "precio_venta", label: "Precio de Venta ($)", type: "number" },
        { key: "estado", label: "Estado", type: "select", options: [{ value: true, label: "Activo" }, { value: false, label: "Inactivo" }] }
      ];
    }

    return [
      {
        key: "prefijo", label: "Prefijo de Rubro *", type: "select", options: PREFIJOS_OPCIONES,
        onChangeCustom: async (nuevoPref, setForm) => {
          const nuevoCodigo = await getSiguienteCodigo(nuevoPref);
          setForm(prev => ({ ...prev, prefijo: nuevoPref, codigo: nuevoCodigo }));
        }
      },
      { key: "codigo", label: "Código Interno (Auto)", readOnly: true },
      { key: "codigo_barras", label: "Código de Barras (Opcional)", placeholder: "Ej: 7791234567890" },
      { key: "nombre", label: "Nombre del Producto *" },
      { key: "descripcion", label: "Descripción" },
      { key: "id_rubro", label: "Categoría", type: "select", options: rubros.map(r => ({ value: r.id_rubro, label: r.nombre })) },
      { key: "id_unidad", label: "Unidad", type: "select", options: unidades.map(u => ({ value: u.id_unidad, label: u.nombre })) },
      { key: "precio_costo", label: "Costo ($)", type: "number" },
      { key: "precio_venta", label: "Precio de Venta ($)", type: "number" }
    ];
  }, [rubros, unidades, selectedProduct]);

  const handleOpenCreate = async () => {
    const cod = await getSiguienteCodigo("MED");
    setSelectedProduct(null);
    setInitialFormData({
      prefijo: "MED",
      codigo: cod,
      codigo_barras: "",
      nombre: "",
      descripcion: "",
      id_rubro: rubros[0]?.id_rubro || 1,
      id_unidad: unidades[0]?.id_unidad || 1,
      precio_costo: 0,
      precio_venta: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setInitialFormData(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (formData) => {
    if (!formData.codigo || formData.codigo.trim() === "") {
      showAlert.errorSave("El código interno es obligatorio.");
      return;
    }

    if (formData.codigo_barras && !/^\d+$/.test(formData.codigo_barras)) {
      showAlert.errorSave("El código de barras debe contener únicamente números.");
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
    if (!formData.nombre?.trim()) return alert("El nombre del producto es obligatorio.");

    const payload = {
      id_rubro: Number(formData.id_rubro) || (rubros[0]?.id_rubro ?? 1),
      id_unidad: Number(formData.id_unidad) || (unidades[0]?.id_unidad ?? 1),
      codigo: formData.codigo.trim(),
      codigo_barras: formData.codigo_barras ? String(formData.codigo_barras).trim() : null,
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion ? formData.descripcion.trim() : null,
      precio_costo: Number(formData.precio_costo) || 0,
      precio_venta: Number(formData.precio_venta) || 0,
      estado: selectedProduct ? (String(formData.estado) === "true") : true
    };

    if (selectedProduct) {
      // --- MODO EDICIÓN ---
      const { error } = await updateArticulo(selectedProduct.id_articulo, payload);

      if (error) {
        showAlert.errorSave(`Error: ${error.message}`);
      } else {
        showAlert.successAction("Producto", true);
        fetchProducts();
        setIsModalOpen(false);
      }
    } else {
      // --- MODO CREACIÓN ---
      const { error } = await createArticulo(payload);

      if (error) {
        showAlert.errorSave(`Error: ${error.message}`);
      } else {
        showAlert.successAction("Producto", false);
        fetchProducts(); 
        setIsModalOpen(false); 
      }
    }
  };

  const filteredProducts = products.filter(p =>
    (p.nombre + (p.codigo || "") + (p.codigo_barras || "")).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { header: "CÓDIGO", accessor: "codigo" },
    { header: "C. BARRAS", accessor: "codigo_barras" },
    { header: "NOMBRE", render: (p) => <b>{p.nombre}</b> },
    { header: "COSTO", render: (p) => `$${p.precio_costo}` },
    { header: "PRECIO VENTA", render: (p) => <b style={{ color: "#166534" }}>${p.precio_venta}</b> },
    { header: "ESTADO", render: (p) => <Badge variant={p.estado ? "success" : "danger"}>{p.estado ? "ACTIVO" : "INACTIVO"}</Badge> },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Productos</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{products.length} productos registrados</p>
        </div>
        <button onClick={handleOpenCreate} style={{ backgroundColor: "#65482b", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "bold" }}>
          + Nuevo producto
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard title="REGISTRADOS" value={products.length} subtitle="Total histórico" />
        <StatCard title="ACTIVOS" value={products.filter(p => p.estado).length} subtitle="Disponibles" />
        <StatCard title="VALOR INVENTARIO" value={`$${products.reduce((a, p) => a + Number(p.precio_costo), 0).toLocaleString()}`} subtitle="Inversión total" />
      </div>

      <div style={{ marginBottom: "1.5rem", position: "relative" }}>
        <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input type="text" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.6rem 0.6rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", boxSizing: "border-box" }} />
      </div>

      <DataTable columns={columns} data={filteredProducts} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedProduct ? selectedProduct.codigo : "modal-nuevo"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        title={selectedProduct ? "Editar Producto" : "Nuevo Producto"}
        fields={editFields}
        initialData={initialFormData}
      />
    </div>
  );
}