import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js"; // Ajusta la ruta a tu cliente de Supabase
import EditModal from "../components/EditModal.jsx";
import InventarioDeposito from "./InventarioDeposito.jsx"; 
import { Plus, Search, Building2, FileText, CalendarDays, PackagePlus, Eye, Edit3 } from "lucide-react";

export default function Depositos() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Control de vistas (Tarjetas / Inventario detallado)
  const [vistaActual, setVistaActual] = useState("tarjetas");
  const [depositoSeleccionadoInventario, setDepositoSeleccionadoInventario] = useState(null);

  // Estados de datos reales de Supabase
  const [depositos, setDepositos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Modal de Edición / Creación de Depósito
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeposito, setSelectedDeposito] = useState(null);

  // Estados para Modal HU 3 (Asociar Producto)
  const [isAsociarModalOpen, setIsAsociarModalOpen] = useState(false);
  const [depositoAAsociar, setDepositoAAsociar] = useState(null);
  const [formDataAsociar, setFormDataAsociar] = useState({ id_articulo: "", stock_minimo: 10, stock_inicial: 0 });
  const [articulosDisponibles, setArticulosDisponibles] = useState([]);

  // 1. CARGA INICIAL DE DATOS DESDE SUPABASE
  useEffect(() => {
    fetchDatos();
  }, []);

  async function fetchDatos() {
    setLoading(true);

    // Obtener sucursales activas para el selector
    // Obtener sucursales activas para el selector
    const { data: sucursalesData, error: errSuc } = await supabase
      .from("sucursal")
      .select("id_sucursal, descripcion")
      .eq("estado", true); // <--- CAMBIO: true booleano en lugar de "Activo"

    if (!errSuc && sucursalesData) {
      setSucursales(sucursalesData);
    }

    // Obtener depósitos con la información de su sucursal relacionada
    const { data: depositosData, error: errDep } = await supabase
      .from("deposito")
      .select(`
        id_deposito,
        codigo,
        descripcion,
        estado,
        fecha_registro,
        id_sucursal,
        sucursal:id_sucursal ( id_sucursal, descripcion )
      `)
      .order("id_deposito", { ascending: true });

    if (!errDep && depositosData) {
      setDepositos(depositosData);
    }

    setLoading(false);
  }

  // 2. CONFIGURACIÓN DE CAMPOS DEL MODAL
  const editFields = [
  { key: "id_deposito", label: "ID Depósito", type: "text", readOnly: true },
  { key: "codigo", label: "Depósito (Código)", type: "text" },
  { 
    key: "id_sucursal", 
    label: "Sucursal Abastecida", 
    type: "select", 
    options: sucursales.map((s) => ({ 
      value: String(s.id_sucursal), // <-- Siempre string
      label: `${s.id_sucursal} - ${s.descripcion}` 
    })) 
  },
  { key: "descripcion", label: "Descripción", type: "text" },
  { 
    key: "estado", 
    label: "Estado", 
    type: "select", 
    options: [
      { value: "Activo", label: "Activo" }, 
      { value: "Inactivo", label: "Inactivo" }
    ] 
  },
];

const handleOpenCreate = () => {
  setSelectedDeposito({
    codigo: "",
    id_sucursal: "",
    descripcion: "",
    estado: "Activo"
  });
  setIsModalOpen(true);
};

const handleOpenEdit = (deposito) => {
  setSelectedDeposito({
    ...deposito,
    id_sucursal: deposito.id_sucursal ? String(deposito.id_sucursal) : "",
    estado: deposito.estado ? "Activo" : "Inactivo"
  });
  setIsModalOpen(true);
};

  // 3. GUARDAR EN SUPABASE: INSERT O UPDATE
const handleSaveDeposito = async (formData) => {
  const idSucursalFinal = formData.id_sucursal ? parseInt(formData.id_sucursal) : null;
  const estadoBoolean = formData.estado === "Activo" || formData.estado === true;

  if (selectedDeposito && selectedDeposito.id_deposito) {
    // ACTUALIZAR
    const { error } = await supabase
      .from("deposito")
      .update({
        codigo: formData.codigo,
        id_sucursal: idSucursalFinal,
        descripcion: formData.descripcion,
        estado: estadoBoolean
      })
      .eq("id_deposito", selectedDeposito.id_deposito);

    if (error) {
      alert("Error al actualizar depósito: " + error.message);
    } else {
      setIsModalOpen(false);
      fetchDatos();
    }
  } else {
    // CREAR
    const { error } = await supabase
      .from("deposito")
      .insert([
        {
          codigo: formData.codigo,
          id_sucursal: idSucursalFinal,
          descripcion: formData.descripcion,
          estado: estadoBoolean,
          fecha_registro: new Date().toISOString()
        }
      ]);

    if (error) {
      alert("Error al crear el depósito: " + error.message);
    } else {
      setIsModalOpen(false);
      fetchDatos();
    }
  }
};

  // 4. LÓGICA DE APERTURA HU 3 (Cargar medicamentos activos)
  const abrirModalAsociar = async (deposito) => {
    setDepositoAAsociar(deposito);
    setFormDataAsociar({ id_articulo: "", stock_minimo: 10, stock_inicial: 0 });

    const { data: articulosData } = await supabase
      .from("articulo")
      .select("id_articulo, codigo, nombre")
      .eq("estado", true);

    if (articulosData) setArticulosDisponibles(articulosData);
    setIsAsociarModalOpen(true);
  };

  // 5. GUARDAR ASOCIACIÓN (HU 3)
  const handleGuardarAsociacion = async (e) => {
    e.preventDefault();
    if (!formDataAsociar.id_articulo) {
      alert("Debes seleccionar un producto.");
      return;
    }

    // Validar duplicados en articulopordeposito
    const { data: existente } = await supabase
      .from("articulopordeposito")
      .select("id_articulo_deposito")
      .eq("id_articulo", formDataAsociar.id_articulo)
      .eq("id_deposito", depositoAAsociar.id_deposito)
      .maybeSingle();

    if (existente) {
      alert("Este artículo ya está asociado a este depósito.");
      return;
    }

    const stockInicial = parseInt(formDataAsociar.stock_inicial) || 0;
    const stockMinimo = parseInt(formDataAsociar.stock_minimo) || 0;

    const { data: nuevaAsociacion, error: errInsert } = await supabase
      .from("articulopordeposito")
      .insert([
        {
          id_articulo: parseInt(formDataAsociar.id_articulo),
          id_deposito: depositoAAsociar.id_deposito,
          stock_actual: stockInicial,
          stock_minimo: stockMinimo,
          estado: "true",
          fecha_registro: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (errInsert) {
      alert("Error al asociar: " + errInsert.message);
      return;
    }

    // Trazabilidad inicial si hay stock
    if (stockInicial > 0 && nuevaAsociacion) {
      await supabase.from("movimientostock").insert([
        {
          id_articulo_deposito: nuevaAsociacion.id_articulo_deposito,
          id_lote: null,
          tipo_movimiento: "INGRESO_INICIAL",
          cantidad: stockInicial,
          fecha_movimiento: new Date().toISOString()
        }
      ]);
    }

    alert("¡Producto asociado exitosamente!");
    setIsAsociarModalOpen(false);
  };

  const filteredDepositos = depositos.filter((d) => 
    d.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // RENDER CONDICIONAL A LA VISTA DE INVENTARIO
  if (vistaActual === "inventario") {
    return (
      <InventarioDeposito 
        deposito={depositoSeleccionadoInventario} 
        onBack={() => setVistaActual("tarjetas")} 
      />
    );
  }

  return (
    <div style={{ padding: "1rem" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Depósitos</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            {loading ? "Cargando depósitos..." : `${depositos.length} depósitos registrados`}
          </p>
        </div>
        <button 
          onClick={handleOpenCreate} 
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nuevo depósito
        </button>
      </header>

      {/* Buscador */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input 
            type="text" 
            placeholder="Buscar por Código o Descripción..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }} 
          />
        </div>
      </div>

      {/* Cuadrícula de Tarjetas */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Cargando datos desde la base de datos...</div>
      ) : filteredDepositos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280", border: "1px dashed #d1d5db", borderRadius: "0.5rem" }}>
          No se encontraron depósitos registrados.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
          {filteredDepositos.map((deposito) => (
            <div key={deposito.id_deposito} style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "1.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", display: "flex", flexDirection: "column", gap: "1rem" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>ID: {deposito.id_deposito}</span>
                  <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.125rem", color: "#111827", fontWeight: "700" }}>{deposito.codigo}</h3>
                </div>
                <span 
                  style={{ 
                    backgroundColor: deposito.estado ? "#dcfce7" : "#f3f4f6", 
                    color: deposito.estado ? "#166534" : "#4b5563", 
                    padding: "0.25rem 0.75rem", 
                    borderRadius: "1rem", 
                    fontSize: "0.75rem", 
                    fontWeight: "600", 
                    textTransform: "uppercase" 
                  }}
                >
                  {deposito.estado ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", color: "#4b5563", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <Building2 size={16} color="#9ca3af" style={{ minWidth: "16px" }} />
                  <span><strong style={{ color: "#374151" }}>Sucursal:</strong> {deposito.sucursal?.descripcion || `ID ${deposito.id_sucursal}`}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <FileText size={16} color="#9ca3af" style={{ minWidth: "16px", marginTop: "2px" }} />
                  <span><strong style={{ color: "#374151" }}>Descripción:</strong> {deposito.descripcion || "Sin descripción"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <CalendarDays size={16} color="#9ca3af" style={{ minWidth: "16px" }} />
                  <span><strong style={{ color: "#374151" }}>Fecha:</strong> {deposito.fecha_registro ? new Date(deposito.fecha_registro).toLocaleDateString() : "N/A"}</span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1.25rem", marginTop: "auto", display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button 
                  onClick={() => {
                    setDepositoSeleccionadoInventario(deposito);
                    setVistaActual("inventario");
                  }} 
                  style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", backgroundColor: "#f9fafb", color: "#374151", border: "1px solid #d1d5db", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}
                >
                  <Eye size={14} /> Ver Inventario
                </button>
                
                <button 
                  onClick={() => abrirModalAsociar(deposito)} 
                  style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", backgroundColor: "#4E6B4F", color: "#ffffff", border: "none", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}
                >
                  <PackagePlus size={14} /> Asociar
                </button>
                
                <button 
                  onClick={() => handleOpenEdit(deposito)} 
                  style={{ flex: "0 1 auto", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", color: "#65482b", border: "1px solid #65482b", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}
                  title="Editar Depósito"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ABM de Depósitos */}
      <EditModal
        key={selectedDeposito ? selectedDeposito.id_deposito : "nuevo-deposito"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDeposito}
        title={selectedDeposito ? "Editar Depósito" : "Nuevo Depósito"}
        fields={editFields.filter((f) => selectedDeposito || f.key !== "id_deposito")} 
        initialData={selectedDeposito}
      />

      {/* Modal HU 3: Asociar Producto */}
      {isAsociarModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "500px", padding: "1.5rem", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "1.5rem" }}>
              Asociar Producto a {depositoAAsociar?.codigo}
            </h2>
            
            <form onSubmit={handleGuardarAsociacion} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Producto (Activo)</label>
                <select 
                  value={formDataAsociar.id_articulo} 
                  onChange={(e) => setFormDataAsociar({ ...formDataAsociar, id_articulo: e.target.value })}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }}
                  required
                >
                  <option value="" disabled>Seleccione un producto...</option>
                  {articulosDisponibles.map((art) => (
                    <option key={art.id_articulo} value={art.id_articulo}>
                      [{art.codigo}] {art.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Stock Inicial</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={formDataAsociar.stock_inicial} 
                    onChange={(e) => setFormDataAsociar({ ...formDataAsociar, stock_inicial: e.target.value })} 
                    style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }} 
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Stock Mínimo</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={formDataAsociar.stock_minimo} 
                    onChange={(e) => setFormDataAsociar({ ...formDataAsociar, stock_minimo: e.target.value })} 
                    style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }} 
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.25rem" }}>
                <button 
                  type="button" 
                  onClick={() => setIsAsociarModalOpen(false)} 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#4E6B4F", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Vincular Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}