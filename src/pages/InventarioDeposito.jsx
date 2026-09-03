import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js";
import AsociarProductoModal from "../components/AsociarProductoModal.jsx";
import AjusteStockModal from "../components/AjusteStockModal.jsx";
import HistorialMovimientosModal from "../components/HistorialMovimientosModal.jsx";
import HistorialDepositoModal from "../components/HistorialDepositoModal.jsx";
import { Plus, PackageCheck, ClipboardList, Edit2, X } from "lucide-react";

export default function InventarioDeposito() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeId = params.id || searchParams.get("id");

  const [listaDepositos, setListaDepositos] = useState([]);
  const [deposito, setDeposito] = useState(null);
  const [inventario, setInventario] = useState([]);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todas");

  // Modales
  const [isModalAsociarOpen, setIsModalAsociarOpen] = useState(false);
  const [isModalAjusteOpen, setIsModalAjusteOpen] = useState(false);
  const [isModalHistorialDepOpen, setIsModalHistorialDepOpen] = useState(false);
  const [articuloSeleccionadoHistorial, setArticuloSeleccionadoHistorial] = useState(null);

  // Modal para Editar Mínimo
  const [itemEditarMinimo, setItemEditarMinimo] = useState(null);
  const [nuevoStockMinimo, setNuevoStockMinimo] = useState("");

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
  useEffect(() => {
    async function init() {
      const { data: deps } = await supabase
        .from("deposito")
        .select("id_deposito, codigo, descripcion, rubros_permitidos, id_sucursal")
        .order("id_deposito", { ascending: true });

      if (deps && deps.length > 0) {
        setListaDepositos(deps);
        const target = deps.find(d => String(d.id_deposito) === String(activeId)) || deps[0];
        setDeposito(target);
        fetchInventario(target.id_deposito);
      }
    }
    init();
  }, [activeId]);

  async function fetchInventario(depId) {
    const { data: articulosDep } = await supabase
      .from("articulo_deposito")
      .select(`
        id_articulo_deposito,
        id_articulo,
        stock_minimo,
        articulo:id_articulo (
          id_articulo,
          codigo,
          nombre,
          rubro:id_rubro (nombre)
        )
      `)
      .eq("id_deposito", depId);

    if (fetchError) {
      console.error("Error al cargar inventario:", fetchError);
      setError("No se pudo cargar el inventario: " + fetchError.message);
      setInventory([]);
    } else {
      setInventory(
        (data || []).map((item) => ({
          ...item,
          codigo: item.articulo?.codigo || "S/C",
          nombre: item.articulo?.nombre || "Sin nombre",
          categoria: item.articulo?.rubro?.nombre || "Sin categoría",
          estado: item.estado === true || item.estado === "true" || item.estado === "Activo" ? "Activo" : "Inactivo",
        }))
      );
    }

    setLoading(false);
  }, [depositoId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // 2. MODAL: AGREGAR NUEVO ARTÍCULO (HU 3)
  async function openNewAssociation() {
    const { data, error: articlesError } = await supabase
      .from("articulo")
      .select("id_articulo, codigo, nombre")
      .order("nombre", { ascending: true });

    if (articlesError) {
      showAlert.errorSave("No se pudieron cargar los productos: " + articlesError.message);
      return;
    }

    const calculados = await Promise.all(
      articulosDep.map(async (item) => {
        const { data: movs } = await supabase
          .from("movimiento_stock")
          .select("cantidad, tipo_movimiento")
          .eq("id_articulo_deposito", item.id_articulo_deposito);

        const stockReal = (movs || []).reduce((sum, m) => {
          const cant = Math.abs(Number(m.cantidad) || 0);
          const tipoNorm = (m.tipo_movimiento || "").toUpperCase();
          const esResta = tipoNorm.includes("EGRESO") || 
                          tipoNorm.includes("MERMA") || 
                          tipoNorm.includes("ROTURA") || 
                          tipoNorm.includes("VENCIMIENTO");
          return esResta ? sum - cant : sum + cant;
        }, 0);

        return { ...item, stock_actual: Math.max(0, stockReal) };
      })
    );

    setInventario(calculados);
  }

  const handleCambiarDeposito = (nuevoId) => {
    navigate(`/depositos/${nuevoId}/inventario`);
  };

  const handleAbrirModalMinimo = (e, item) => {
    e.stopPropagation();
    setItemEditarMinimo(item);
    setNuevoStockMinimo(item.stock_minimo);
  };

  const handleGuardarMinimo = async (e) => {
    e.preventDefault();
    if (!itemEditarMinimo) return;

    const { error } = await supabase
      .from("articulo_deposito")
      .update({ stock_minimo: parseInt(nuevoStockMinimo) || 0 })
      .eq("id_articulo_deposito", itemEditarMinimo.id_articulo_deposito);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      setItemEditarMinimo(null);
      fetchInventario(deposito.id_deposito);
    }
  };

  const totalAsociados = inventario.length;
  const stockOptimo = inventario.filter(i => i.stock_actual > i.stock_minimo).length;
  const stockBajo = inventario.filter(i => i.stock_actual <= i.stock_minimo && i.stock_actual > 0).length;
  const sinStock = inventario.filter(i => i.stock_actual === 0).length;

  const productosFiltrados = inventario.filter((item) => {
    const txt = search.toLowerCase();
    const matchTxt = item.articulo?.nombre?.toLowerCase().includes(txt) || item.articulo?.codigo?.toLowerCase().includes(txt);
    if (filtroEstado === "Todas") return matchTxt;
    if (filtroEstado === "Optimo") return matchTxt && item.stock_actual > item.stock_minimo;
    if (filtroEstado === "Stock Bajo") return matchTxt && item.stock_actual <= item.stock_minimo && item.stock_actual > 0;
    if (filtroEstado === "Sin Stock") return matchTxt && item.stock_actual === 0;
    return matchTxt;
  });

  return (
    <div style={{ padding: "2rem" }}>
      {/* Selector superior */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <button
          onClick={() => navigate("/depositos")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#65482b", fontWeight: "bold", fontSize: "1rem" }}
        >
          ← Volver a Depósitos
        </button>

        {listaDepositos.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#374151" }}>Cambiar de depósito:</label>
            <select
              value={deposito?.id_deposito || ""}
              onChange={(e) => handleCambiarDeposito(e.target.value)}
              style={{ padding: "0.45rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontWeight: "500", backgroundColor: "#fff" }}
            >
              {listaDepositos.map(d => (
                <option key={d.id_deposito} value={d.id_deposito}>
                  {d.codigo} – {d.descripcion}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cabecera y Botones */}
      {deposito && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.85rem", color: "#111827" }}>Inventario: {deposito.codigo}</h1>
            <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.95rem" }}>
              {deposito.descripcion} — {totalAsociados} productos en existencia
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setIsModalHistorialDepOpen(true)}
              style={{
                backgroundColor: "#4b5563",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.5rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer"
              }}
              title="Ver auditoría general de todos los movimientos de este depósito"
            >
              <ClipboardList size={18} /> Movimientos del Depósito
            </button>

            <button
              onClick={() => setIsModalAsociarOpen(true)}
              style={{
                backgroundColor: "#365314",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.5rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer"
              }}
            >
              <Plus size={18} /> Asociar Producto
            </button>

            <button
              onClick={() => setIsModalAjusteOpen(true)}
              style={{
                backgroundColor: "#65482b",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.5rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer"
              }}
            >
              <PackageCheck size={18} /> Ajuste Masivo de Stock
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas - Con STOCK ÓPTIMO / ALTO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#6b7280" }}>PRODUCTOS ASOCIADOS</span>
          <h2 style={{ margin: "0.25rem 0 0 0", fontSize: "1.75rem" }}>{totalAsociados}</h2>
        </div>
        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#6b7280" }}>STOCK ÓPTIMO (ALTO)</span>
          <h2 style={{ margin: "0.25rem 0 0 0", fontSize: "1.75rem", color: "#16a34a" }}>{stockOptimo}</h2>
        </div>
        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#6b7280" }}>STOCK BAJO</span>
          <h2 style={{ margin: "0.25rem 0 0 0", fontSize: "1.75rem", color: "#ca8a04" }}>{stockBajo}</h2>
        </div>
        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#6b7280" }}>SIN STOCK (QUIEBRE)</span>
          <h2 style={{ margin: "0.25rem 0 0 0", fontSize: "1.75rem", color: "#dc2626" }}>{sinStock}</h2>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
        <input
          type="text"
          placeholder="Buscar por código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ padding: "0.55rem 0.85rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#fff" }}
        >
          <option value="Todas">Todas</option>
          <option value="Optimo">Stock Óptimo (Alto)</option>
          <option value="Stock Bajo">Stock Bajo</option>
          <option value="Sin Stock">Sin Stock</option>
        </select>
      </div>

      {/* Tabla con clic para abrir el Historial del producto */}
      <div style={{ background: "#fff", borderRadius: "0.5rem", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
              <th style={{ padding: "0.85rem 1rem" }}>CÓDIGO</th>
              <th style={{ padding: "0.85rem 1rem" }}>PRODUCTO</th>
              <th style={{ padding: "0.85rem 1rem" }}>CATEGORÍA</th>
              <th style={{ padding: "0.85rem 1rem" }}>STOCK ACTUAL</th>
              <th style={{ padding: "0.85rem 1rem" }}>STOCK MÍNIMO</th>
              <th style={{ padding: "0.85rem 1rem" }}>ESTADO</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "right" }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.length > 0 ? (
              productosFiltrados.map((item) => (
                <tr
                  key={item.id_articulo_deposito}
                  onClick={() => setArticuloSeleccionadoHistorial(item)}
                  style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer", transition: "background-color 0.15s ease" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  title="Haz clic para ver trazabilidad e historial"
                >
                  <td style={{ padding: "0.85rem 1rem", fontWeight: "bold" }}>{item.articulo?.codigo}</td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: "500" }}>{item.articulo?.nombre}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#4b5563" }}>{item.articulo?.rubro?.nombre || "General"}</td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: "bold", fontSize: "1.05rem" }}>{item.stock_actual}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>{item.stock_minimo}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{
                      padding: "0.2rem 0.55rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold",
                      backgroundColor: item.stock_actual === 0 ? "#fee2e2" : item.stock_actual <= item.stock_minimo ? "#fef9c3" : "#dcfce7",
                      color: item.stock_actual === 0 ? "#991b1b" : item.stock_actual <= item.stock_minimo ? "#854d0e" : "#166534"
                    }}>
                      {item.stock_actual === 0 ? "SIN STOCK" : item.stock_actual <= item.stock_minimo ? "STOCK BAJO" : "ÓPTIMO"}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                    <button
                      onClick={(e) => handleAbrirModalMinimo(e, item)}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", border: "1px solid #d1d5db", borderRadius: "0.25rem", cursor: "pointer", background: "#fff", display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: "600" }}
                      title="Modificar Stock Mínimo de Alerta"
                    >
                      <Edit2 size={13} /> Mínimo
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: "2.5rem", textAlign: "center", color: "#6b7280" }}>
                  No hay productos asociados a este depósito.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Definir Stock Mínimo */}
      {itemEditarMinimo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem" }}>
          <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "0.5rem", width: "100%", maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700" }}>Definir Stock Mínimo de Alerta</h3>
              <button onClick={() => setItemEditarMinimo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "0 0 1rem 0" }}>
              Producto: <b>{itemEditarMinimo.articulo?.nombre}</b>
            </p>
            <form onSubmit={handleGuardarMinimo} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "0.25rem" }}>
                  Cantidad mínima para generar alerta
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={nuevoStockMinimo}
                  onChange={e => setNuevoStockMinimo(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" onClick={() => setItemEditarMinimo(null)} style={{ padding: "0.5rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: "0.5rem 1.25rem", background: "#365314", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: "bold", cursor: "pointer" }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales de Operación */}
      {deposito && (
        <>
          <AsociarProductoModal
            idDeposito={deposito.id_deposito}
            rubrosPermitidos={deposito.rubros_permitidos || ""}
            productosActuales={inventario}
            isOpen={isModalAsociarOpen}
            onClose={() => setIsModalAsociarOpen(false)}
            onProductoAsociado={() => fetchInventario(deposito.id_deposito)}
          />

          <AjusteStockModal
            idDeposito={deposito.id_deposito}
            productosAsociados={inventario}
            isOpen={isModalAjusteOpen}
            onClose={() => setIsModalAjusteOpen(false)}
            onAjusteGuardado={() => fetchInventario(deposito.id_deposito)}
          />

          {/* Historial Individual del Artículo Seleccionado (Intacto) */}
          <HistorialMovimientosModal
            isOpen={!!articuloSeleccionadoHistorial}
            onClose={() => setArticuloSeleccionadoHistorial(null)}
            articuloDeposito={articuloSeleccionadoHistorial}
            nombreDeposito={deposito.codigo}
          />

          {/* Historial Global de Todo el Depósito */}
          <HistorialDepositoModal
            isOpen={isModalHistorialDepOpen}
            onClose={() => setIsModalHistorialDepOpen(false)}
            idDeposito={deposito.id_deposito}
            nombreDeposito={deposito.codigo}
          />
        </>
      )}
    </div>
  );
}