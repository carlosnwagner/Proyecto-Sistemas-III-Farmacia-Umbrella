import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import EditModal from "../components/EditModal.jsx";
import InventarioDeposito from "./InventarioDeposito.jsx"; 
import { Plus, Search, Building2, FileText, CalendarDays, PackagePlus, Eye, Edit3 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast"; 
import { showAlert } from "../lib/alerts.js";

export default function Depositos() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Control de vistas
  const [vistaActual, setVistaActual] = useState("tarjetas");
  const [depositoSeleccionadoInventario, setDepositoSeleccionadoInventario] = useState(null);

  // Estados de datos
  const [depositos, setDepositos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Modal de Edición / Creación de Depósito
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeposito, setSelectedDeposito] = useState(null);

  // Estados para Modal HU 3 (Asociar Producto con Lote)
  const [isAsociarModalOpen, setIsAsociarModalOpen] = useState(false);
  const [depositoAAsociar, setDepositoAAsociar] = useState(null);
  const [formDataAsociar, setFormDataAsociar] = useState({ 
    id_articulo: "", 
    stock_minimo: 10, 
    stock_inicial: 0,
    numero_lote: "",
    fecha_vencimiento: ""
  });
  const [articulosDisponibles, setArticulosDisponibles] = useState([]);

  // 1. CARGA INICIAL DE DATOS
  useEffect(() => {
    fetchDatos();
  }, []);

  async function fetchDatos() {
    setLoading(true);

    const { data: sucursalesData, error: errSuc } = await supabase
      .from("sucursal")
      .select("id_sucursal, descripcion")
      .eq("estado", true);

    if (!errSuc && sucursalesData) {
      setSucursales(sucursalesData);
    }

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

  // 2. CONFIGURACIÓN DE CAMPOS DEL MODAL DE DEPÓSITO
  const baseEditFields = [
    { key: "codigo", label: "Depósito (Código)", type: "text" },
    { 
      key: "id_sucursal", 
      label: "Sucursal Abastecida", 
      type: "select", 
      options: sucursales.map((s) => ({ 
        value: String(s.id_sucursal), 
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

  // Si estamos creando, filtramos el campo "estado" para que no se muestre
  const editFields = selectedDeposito && selectedDeposito.id_deposito 
    ? baseEditFields 
    : baseEditFields.filter(f => f.key !== "estado");

  const handleOpenCreate = () => {
    setSelectedDeposito({
      codigo: "",
      id_sucursal: "",
      descripcion: "",
      estado: "Activo" // Por defecto activo en creaciones nuevas
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

  // 3. GUARDAR DEPÓSITO (INSERT / UPDATE)
  const handleSaveDeposito = async (formData) => {
    const valorSucursal = formData.id_sucursal !== undefined 
      ? formData.id_sucursal 
      : selectedDeposito?.id_sucursal;

    const idSucursalFinal = (valorSucursal !== "" && valorSucursal !== null && valorSucursal !== undefined)
      ? parseInt(valorSucursal) 
      : null;

    const estadoBoolean = selectedDeposito && selectedDeposito.id_deposito 
      ? (formData.estado === "Activo" || formData.estado === true)
      : true;

    if (selectedDeposito && selectedDeposito.id_deposito) {
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
        await showAlert.error("Error al actualizar depósito: " + error.message);
      } else {
        setIsModalOpen(false);
        fetchDatos();
      }
    } else {
      const { error } = await supabase
        .from("deposito")
        .insert([
          {
            codigo: formData.codigo,
            id_sucursal: idSucursalFinal,
            descripcion: formData.descripcion,
            estado: true,
            fecha_registro: new Date().toISOString()
          }
        ]);

      if (error) {
        await showAlert.error("Error al crear el depósito: " + error.message);
      } else {
        setIsModalOpen(false);
        fetchDatos();
      }
    }
  };

  // 4. ABRIR MODAL DE ASOCIACIÓN HU 3
  const abrirModalAsociar = async (deposito) => {
    if (!deposito.estado) {
      await showAlert.warning("No se pueden asociar productos a un depósito inactivo.");
      return;
    }

    setDepositoAAsociar(deposito);
    setFormDataAsociar({ 
      id_articulo: "", 
      stock_minimo: 10, 
      stock_inicial: 0,
      numero_lote: "",
      fecha_vencimiento: ""
    });

    const { data: todosArticulos, error: errArt } = await supabase
      .from("articulo")
      .select("id_articulo, codigo, nombre")
      .eq("estado", true)
      .order("nombre", { ascending: true });

    if (errArt) {
      await showAlert.error("Error al cargar artículos: " + errArt.message);
      return;
    }

    const { data: yaAsociados, error: errAsoc } = await supabase
      .from("articulo_deposito")
      .select("id_articulo")
      .eq("id_deposito", deposito.id_deposito);

    if (errAsoc) {
      console.error("Error al consultar asociaciones:", errAsoc);
    }

    const idsExistentes = new Set((yaAsociados || []).map((item) => item.id_articulo));
    const disponibles = (todosArticulos || []).filter(
      (art) => !idsExistentes.has(art.id_articulo)
    );

    setArticulosDisponibles(disponibles);
    setIsAsociarModalOpen(true);
  };

  // 5. GUARDAR ASOCIACIÓN + LOTE + MOVIMIENTO
  const handleGuardarAsociacion = async (e) => {
    e.preventDefault();
    if (!formDataAsociar.id_articulo) {
      toast.error("Debes seleccionar un producto.");
      return;
    }

    const stockInicial = parseInt(formDataAsociar.stock_inicial) || 0;
    const stockMinimo = parseInt(formDataAsociar.stock_minimo) || 0;

    if (stockInicial > 0) {
      if (!formDataAsociar.numero_lote.trim()) {
        await showAlert.warning("Debe ingresar el número de lote para el stock inicial.");
        return;
      }
      if (!formDataAsociar.fecha_vencimiento) {
        await showAlert.warning("Debe seleccionar la fecha de vencimiento del lote.");
        return;
      }
    }

    const { data: existente } = await supabase
      .from("articulo_deposito")
      .select("id_articulo_deposito")
      .eq("id_articulo", formDataAsociar.id_articulo)
      .eq("id_deposito", depositoAAsociar.id_deposito)
      .maybeSingle();

    if (existente) {
      toast.error("Este artículo ya está asociado a este depósito.");
      return;
    }

    const { data: nuevaAsociacion, error: errInsert } = await supabase
      .from("articulo_deposito")
      .insert([
        {
          id_articulo: parseInt(formDataAsociar.id_articulo),
          id_deposito: depositoAAsociar.id_deposito,
          stock_actual: stockInicial,
          stock_minimo: stockMinimo,
          estado: true,
          fecha_registro: new Date().toISOString()
        }
      ])
      .select("id_articulo_deposito")
      .single();

    if (errInsert) {
      await showAlert.error("Error al asociar el producto: " + errInsert.message);
      return;
    }

    if (stockInicial > 0 && nuevaAsociacion) {
      const { data: nuevoLote, error: errLote } = await supabase
        .from("lote")
        .insert([
          {
            id_articulo: parseInt(formDataAsociar.id_articulo),
            id_deposito: depositoAAsociar.id_deposito,
            numero_lote: formDataAsociar.numero_lote.trim(),
            fecha_vencimiento: formDataAsociar.fecha_vencimiento,
            cantidad: stockInicial,
            estado: "Vigente",
            fecha_registro: new Date().toISOString()
          }
        ])
        .select("id_lote")
        .single();

      if (errLote) {
        await showAlert.error("Producto asociado, pero ocurrió un error al registrar el lote: " + errLote.message);
      }

      await supabase.from("movimiento_stock").insert([
        {
          id_articulo_deposito: nuevaAsociacion.id_articulo_deposito,
          id_lote: nuevoLote ? nuevoLote.id_lote : null,
          tipo_movimiento: "INGRESO_INICIAL",
          cantidad: stockInicial,
          fecha_movimiento: new Date().toISOString()
        }
      ]);
    }

    await showAlert.successSave("¡Producto y stock vinculados exitosamente!");
    setIsAsociarModalOpen(false);
  };

  const filteredDepositos = depositos.filter((d) => 
    d.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <Toaster position="top-right" reverseOrder={false} />

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
                  <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.125rem", color: "#111827", fontWeight: "700" }}>{deposito.codigo}</h3>
                </div>
                <span 
                  style={{ 
                    backgroundColor: deposito.estado ? "#dcfce7" : "#fee2e2", 
                    color: deposito.estado ? "#166534" : "#991b1b", 
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
                  <span><strong style={{ color: "#374151" }}>Sucursal:</strong> {deposito.sucursal?.descripcion || (deposito.id_sucursal ? `ID ${deposito.id_sucursal}` : "Sin asignar")}</span>
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
                  disabled={!deposito.estado}
                  style={{ 
                    flex: "1 1 auto", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: "0.375rem", 
                    backgroundColor: deposito.estado ? "#4E6B4F" : "#9ca3af", 
                    color: "#ffffff", 
                    border: "none", 
                    padding: "0.5rem 0.75rem", 
                    borderRadius: "0.375rem", 
                    cursor: deposito.estado ? "pointer" : "not-allowed", 
                    fontWeight: "600", 
                    fontSize: "0.8rem" 
                  }}
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
        key={selectedDeposito && selectedDeposito.id_deposito ? selectedDeposito.id_deposito : "nuevo-deposito"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDeposito}
        title={selectedDeposito && selectedDeposito.id_deposito ? "Editar Depósito" : "Nuevo Depósito"}
        fields={editFields}
        initialData={selectedDeposito}
      />

      {/* Modal HU 3: Asociar Producto con Gestión de Lote */}
      {isAsociarModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "1.25rem" }}>
              Asociar Producto a {depositoAAsociar?.codigo}
            </h2>
            
            <form onSubmit={handleGuardarAsociacion} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Producto (Catálogo)</label>
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

              {Number(formDataAsociar.stock_inicial) > 0 && (
                <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Datos del Lote Inicial</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151" }}>N° de Lote</label>
                      <input 
                        type="text" 
                        placeholder="Ej. LOT-2026-01" 
                        value={formDataAsociar.numero_lote} 
                        onChange={(e) => setFormDataAsociar({ ...formDataAsociar, numero_lote: e.target.value })} 
                        style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.85rem" }} 
                        required
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151" }}>Vencimiento</label>
                      <input 
                        type="date" 
                        value={formDataAsociar.fecha_vencimiento} 
                        onChange={(e) => setFormDataAsociar({ ...formDataAsociar, fecha_vencimiento: e.target.value })} 
                        style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.85rem" }} 
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
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