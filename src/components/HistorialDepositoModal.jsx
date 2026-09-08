import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { X, Search, Calendar, Filter } from "lucide-react";

export default function HistorialDepositoModal({ isOpen, onClose, idDeposito, nombreDeposito }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (isOpen && idDeposito) {
      fetchMovimientosGlobales();
    }
  }, [isOpen, idDeposito]);

  async function fetchMovimientosGlobales() {
    setLoading(true);

    const { data, error } = await supabase
      .from("movimiento_stock")
      .select(`
        *,
        articulo_deposito:id_articulo_deposito (
          articulo:id_articulo (
            codigo,
            nombre,
            rubro:id_rubro (nombre)
          )
        )
      `)
      .eq("id_deposito", idDeposito);

    if (error) {
      console.error("Error al obtener movimientos del depósito:", error.message);
      setMovimientos([]);
      setLoading(false);
      return;
    }

    if (data) {
      const ordenados = [...data].sort((a, b) => {
        const idA = a.id_movimiento_stock || a.id_movimiento || 0;
        const idB = b.id_movimiento_stock || b.id_movimiento || 0;
        return idB - idA; // Más recientes primero
      });

      const procesados = ordenados.map((m) => {
        const tipoNorm = (m.tipo_movimiento || "").toUpperCase();
        const esResta = tipoNorm.includes("EGRESO") || 
                        tipoNorm.includes("MERMA") || 
                        tipoNorm.includes("ROTURA") || 
                        tipoNorm.includes("VENCIMIENTO");
        const cant = Math.abs(Number(m.cantidad) || 0);

        return {
          ...m,
          idReal: m.id_movimiento_stock || m.id_movimiento,
          fechaReal: m.fecha_movimiento || m.fecha_registro || m.created_at,
          productoCodigo: m.articulo_deposito?.articulo?.codigo || "---",
          productoNombre: m.articulo_deposito?.articulo?.nombre || "Producto eliminado",
          rubroNombre: m.articulo_deposito?.articulo?.rubro?.nombre || "General",
          esResta,
          cantidadReal: esResta ? -cant : cant
        };
      });

      setMovimientos(procesados);
    }
    setLoading(false);
  }

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      const tipoNorm = (m.tipo_movimiento || "").toUpperCase();
      let matchTipo = true;
      if (filtroTipo === "INGRESOS") matchTipo = !m.esResta;
      else if (filtroTipo === "EGRESOS") matchTipo = m.esResta;
      else if (filtroTipo === "MERMA") matchTipo = tipoNorm.includes("MERMA") || tipoNorm.includes("ROTURA");
      else if (filtroTipo === "VENCIMIENTO") matchTipo = tipoNorm.includes("VENCIMIENTO");

      const txt = busqueda.toLowerCase();
      const matchTxt = m.productoNombre.toLowerCase().includes(txt) ||
                       m.productoCodigo.toLowerCase().includes(txt) ||
                       m.rubroNombre.toLowerCase().includes(txt) ||
                       tipoNorm.includes(txt.toUpperCase());

      return matchTipo && matchTxt;
    });
  }, [movimientos, filtroTipo, busqueda]);

  if (!isOpen) return null;

  const totalIngresado = movimientos
    .filter(m => !m.esResta)
    .reduce((sum, m) => sum + Math.abs(m.cantidadReal), 0);

  const totalEgresado = movimientos
    .filter(m => m.esResta)
    .reduce((sum, m) => sum + Math.abs(m.cantidadReal), 0);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "1000px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        {/* Cabecera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>Auditoría Global de Movimientos</h2>
            <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              Depósito: <b>{nombreDeposito}</b> — Registro unificado de ingresos, egresos, mermas y vencimientos
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={20} /></button>
        </div>

        {/* Métricas del Depósito */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", margin: "1rem 0" }}>
          <div style={{ background: "#f9fafb", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>TOTAL MOVIMIENTOS</span>
            <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#111827" }}>{movimientos.length} operaciones</div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>TOTAL ENTRADAS (+)</span>
            <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#16a34a" }}>+{totalIngresado} u.</div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>TOTAL SALIDAS (-)</span>
            <div style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#dc2626" }}>-{totalEgresado} u.</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Buscar por código, nombre de producto, rubro o motivo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2.2rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
            />
          </div>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: "pointer" }}
          >
            <option value="Todos">Todos los Movimientos</option>
            <option value="INGRESOS">Ingresos (+)</option>
            <option value="EGRESOS">Egresos (-)</option>
            <option value="MERMA">Mermas y Roturas (-)</option>
            <option value="VENCIMIENTO">Vencimientos (-)</option>
          </select>
        </div>

        {/* Tabla general */}
        <div style={{ overflowY: "auto", flex: 1, border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, borderBottom: "1px solid #e5e7eb", color: "#4b5563" }}>
              <tr>
                <th style={{ padding: "0.75rem 1rem" }}>FECHA Y HORA</th>
                <th style={{ padding: "0.75rem 1rem" }}>CÓDIGO</th>
                <th style={{ padding: "0.75rem 1rem" }}>PRODUCTO</th>
                <th style={{ padding: "0.75rem 1rem" }}>RUBRO</th>
                <th style={{ padding: "0.75rem 1rem" }}>MOTIVO</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>IMPACTO</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Cargando movimientos del depósito...</td></tr>
              ) : movimientosFiltrados.length > 0 ? (
                movimientosFiltrados.map((m) => {
                  const fechaTexto = m.fechaReal 
                    ? new Date(m.fechaReal).toLocaleString() 
                    : `Registro #${m.idReal || "S/N"}`;

                  return (
                    <tr key={m.idReal || Math.random()} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#4b5563", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <Calendar size={14} color="#9ca3af" />
                          <span>{fechaTexto}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "bold" }}>{m.productoCodigo}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: "500" }}>{m.productoNombre}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#6b7280" }}>{m.rubroNombre}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          padding: "0.2rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600",
                          backgroundColor: !m.esResta ? "#dcfce7" : "#fee2e2",
                          color: !m.esResta ? "#166534" : "#991b1b"
                        }}>
                          {m.tipo_movimiento}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "bold", fontSize: "0.95rem", color: !m.esResta ? "#16a34a" : "#dc2626" }}>
                        {m.cantidadReal > 0 ? `+${m.cantidadReal}` : m.cantidadReal}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                    No se encontraron movimientos registrados en este depósito.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button
            onClick={onClose}
            style={{ padding: "0.5rem 1.25rem", backgroundColor: "#374151", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}