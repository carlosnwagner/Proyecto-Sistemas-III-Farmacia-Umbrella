import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { X, Search, Calendar } from "lucide-react";

export default function HistorialMovimientosModal({ isOpen, onClose, articuloDeposito, nombreDeposito }) {
  const [movimientosRaw, setMovimientosRaw] = useState([]);
  const [stockInicial, setStockInicial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const idRelacion = articuloDeposito?.id_articulo_deposito ? parseInt(articuloDeposito.id_articulo_deposito) : null;

  useEffect(() => {
    if (isOpen && idRelacion) {
      fetchMovimientos();
    }
  }, [isOpen, idRelacion]);

  async function fetchMovimientos() {
    setLoading(true);

    const { data, error } = await supabase
      .from("movimiento_stock")
      .select("*")
      .eq("id_articulo_deposito", idRelacion);

    if (error) {
      console.error("Error al consultar movimientos:", error.message);
      setMovimientosRaw([]);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const ordenados = [...data].sort((a, b) => {
        const idA = a.id_movimiento_stock || a.id_movimiento || 0;
        const idB = b.id_movimiento_stock || b.id_movimiento || 0;
        return idA - idB;
      });

      // Detección de stock inicial
      const primerMov = ordenados.find(m => (m.tipo_movimiento || "").toUpperCase() === "INGRESO_INICIAL");
      const cantInicial = primerMov ? Math.abs(Number(primerMov.cantidad)) : Math.abs(Number(ordenados[0].cantidad));
      setStockInicial(cantInicial);

      let saldo = 0;
      const procesados = ordenados.map((m) => {
        const stockAnterior = saldo;
        const cantPositiva = Math.abs(Number(m.cantidad) || 0);
        const tipoNorm = (m.tipo_movimiento || "").toUpperCase();

        const esResta = tipoNorm.includes("EGRESO") || 
                        tipoNorm.includes("MERMA") || 
                        tipoNorm.includes("ROTURA") || 
                        tipoNorm.includes("VENCIMIENTO");

        saldo = esResta ? saldo - cantPositiva : saldo + cantPositiva;

        return {
          ...m,
          idReal: m.id_movimiento_stock || m.id_movimiento,
          fechaReal: m.fecha_movimiento || m.fecha_registro || m.created_at,
          esResta,
          cantidadReal: esResta ? -cantPositiva : cantPositiva,
          stockAnterior,
          stockPosterior: Math.max(0, saldo)
        };
      });

      setMovimientosRaw(procesados.reverse());
    } else {
      setMovimientosRaw([]);
      setStockInicial(0);
    }
    setLoading(false);
  }

  const movimientosFiltrados = useMemo(() => {
    return movimientosRaw.filter((m) => {
      const tipoNorm = (m.tipo_movimiento || "").toUpperCase();

      let matchTipo = true;
      if (filtroTipo === "INGRESOS") {
        matchTipo = !m.esResta; // Todos los ingresos
      } else if (filtroTipo === "EGRESOS") {
        matchTipo = m.esResta; // Todos los egresos
      } else if (filtroTipo === "MERMA") {
        matchTipo = tipoNorm.includes("MERMA") || tipoNorm.includes("ROTURA");
      } else if (filtroTipo === "VENCIMIENTO") {
        matchTipo = tipoNorm.includes("VENCIMIENTO");
      }

      const matchTxt = tipoNorm.includes(busqueda.toUpperCase());
      return matchTipo && matchTxt;
    });
  }, [movimientosRaw, filtroTipo, busqueda]);

  if (!isOpen || !articuloDeposito) return null;

  const stockActual = articuloDeposito.stock_actual || 0;
  const stockMinimo = articuloDeposito.stock_minimo || 0;
  const diferencia = stockActual - stockInicial;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "920px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        
        {/* Cabecera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>Movimientos de Stock</h2>
            <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              Depósito: <b>{nombreDeposito}</b> | Producto: <b>[{articuloDeposito.articulo?.codigo}] {articuloDeposito.articulo?.nombre}</b>
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={20} /></button>
        </div>

        {/* Resumen numérico */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", margin: "1rem 0" }}>
          <div style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>STOCK INICIAL</span>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#374151" }}>{stockInicial} u.</div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>STOCK ACTUAL</span>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: stockActual > stockMinimo ? "#166534" : "#ca8a04" }}>{stockActual} u.</div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>STOCK MÍNIMO</span>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#111827" }}>{stockMinimo} u.</div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "bold" }}>BALANCE NETO</span>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: diferencia >= 0 ? "#166534" : "#dc2626" }}>
              {diferencia > 0 ? `+${diferencia}` : diferencia} u.
            </div>
          </div>
        </div>

        {/* Barra de Filtros con Ingresos y Egresos */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Buscar por motivo..."
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
            <option value="MERMA">Merma o Rotura (-)</option>
            <option value="VENCIMIENTO">Vencimiento (-)</option>
          </select>
        </div>

        {/* Tabla Kardex */}
        <div style={{ overflowY: "auto", flex: 1, border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, borderBottom: "1px solid #e5e7eb", color: "#4b5563" }}>
              <tr>
                <th style={{ padding: "0.75rem 1rem" }}>FECHA / REGISTRO</th>
                <th style={{ padding: "0.75rem 1rem" }}>MOVIMIENTO</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>STOCK ANTERIOR</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>IMPACTO</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>STOCK FINAL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Cargando auditoría de movimientos...</td></tr>
              ) : movimientosFiltrados.length > 0 ? (
                movimientosFiltrados.map((m) => {
                  const fechaTexto = m.fechaReal 
                    ? new Date(m.fechaReal).toLocaleString() 
                    : `Registro #${m.idReal || "S/N"}`;

                  return (
                    <tr key={m.idReal || Math.random()} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <Calendar size={14} color="#9ca3af" />
                          <span>{fechaTexto}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          padding: "0.2rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600",
                          backgroundColor: !m.esResta ? "#dcfce7" : "#fee2e2",
                          color: !m.esResta ? "#166534" : "#991b1b"
                        }}>
                          {m.tipo_movimiento}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#6b7280" }}>
                        {m.stockAnterior}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "bold", color: !m.esResta ? "#16a34a" : "#dc2626" }}>
                        {m.cantidadReal > 0 ? `+${m.cantidadReal}` : m.cantidadReal}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "bold", color: "#111827" }}>
                        {m.stockPosterior}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                    No se encontraron movimientos registrados para este criterio.
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