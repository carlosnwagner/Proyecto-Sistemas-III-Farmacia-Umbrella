import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { Plus, Trash2, X } from "lucide-react";

export default function AsociarProductoModal({
  idDeposito,
  rubrosPermitidos = "",
  productosActuales = [],
  isOpen,
  onClose,
  onProductoAsociado
}) {
  const [articulosDisponibles, setArticulosDisponibles] = useState([]);
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCatalogo();
    }
  }, [isOpen]);

  async function fetchCatalogo() {
    const { data } = await supabase.from("articulo").select("id_articulo, nombre, codigo");
    if (data) {
      const idsYaAsociados = productosActuales.map(p => Number(p.id_articulo));
      let filtrados = data.filter(a => !idsYaAsociados.includes(Number(a.id_articulo)));

      if (rubrosPermitidos && rubrosPermitidos.trim() !== "") {
        const permitidos = rubrosPermitidos.split(",").map(r => r.trim().toUpperCase());
        filtrados = filtrados.filter(a => {
          const pref = a.codigo ? a.codigo.split("-")[0].toUpperCase() : "";
          return permitidos.includes(pref);
        });
      }
      setArticulosDisponibles(filtrados);

      const anio = new Date().getFullYear();
      const loteBase = `LOT-${anio}-${Math.floor(1000 + Math.random() * 9000)}`;
      setFilas([
        {
          id_articulo: "",
          stock_inicial: 1,
          stock_minimo: 10,
          numero_lote: loteBase,
          fecha_vencimiento: "2027-12-31"
        }
      ]);
    }
  }

  if (!isOpen) return null;

  const seleccionadosIds = filas.map(f => f.id_articulo).filter(Boolean);
  const puedeAgregarMas = filas.length < articulosDisponibles.length;

  const handleAgregarFila = () => {
    if (puedeAgregarMas) {
      const anio = new Date().getFullYear();
      setFilas([
        ...filas,
        {
          id_articulo: "",
          stock_inicial: 1,
          stock_minimo: 10,
          numero_lote: `LOT-${anio}-${Math.floor(1000 + Math.random() * 9000)}`,
          fecha_vencimiento: "2027-12-31"
        }
      ]);
    }
  };

  const handleEliminarFila = (index) => {
    if (filas.length === 1) return;
    setFilas(filas.filter((_, i) => i !== index));
  };

  const handleActualizarFila = (index, campo, valor) => {
    const copy = [...filas];
    copy[index][campo] = valor;
    setFilas(copy);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const f of filas) {
      if (!f.id_articulo || Number(f.stock_inicial) < 0 || Number(f.stock_minimo) < 0) {
        alert("Por favor selecciona todos los productos y verifica que las cantidades sean válidas.");
        return;
      }
    }

    setLoading(true);

    try {
      const depId = parseInt(idDeposito);

      for (const item of filas) {
        const artId = parseInt(item.id_articulo);
        const cant = parseInt(item.stock_inicial) || 0;

        // 1. Vincular articulo a deposito
        const { data: rel, error: errRel } = await supabase
          .from("articulo_deposito")
          .upsert(
            [{ id_articulo: artId, id_deposito: depId, stock_minimo: parseInt(item.stock_minimo) || 0 }],
            { onConflict: "id_articulo,id_deposito" }
          )
          .select()
          .single();

        if (errRel) throw new Error(errRel.message);

        // 2. Crear lote
        let idLote = null;
        const { data: loteCreado, error: errLote } = await supabase
          .from("lote")
          .insert([
            {
              id_articulo: artId,
              numero_lote: item.numero_lote,
              fecha_vencimiento: item.fecha_vencimiento,
              cantidad: cant,
              estado: true
            }
          ])
          .select()
          .maybeSingle();

        if (!errLote && loteCreado) {
          idLote = loteCreado.id_lote;
        }

        // 3. Crear movimiento de stock inicial
        const { error: errMov } = await supabase
          .from("movimiento_stock")
          .insert([
            {
              id_deposito: depId,
              id_articulo_deposito: rel.id_articulo_deposito,
              id_lote: idLote,
              tipo_movimiento: "INGRESO_INICIAL",
              cantidad: cant
            }
          ]);

        if (errMov) throw new Error(errMov.message);
      }

      alert(`¡Se asociaron con éxito ${filas.length} producto(s) al depósito!`);
      onProductoAsociado();
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem" }}>
      <div style={{ backgroundColor: "#fff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "780px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Asociar Producto(s) al Depósito</h2>
            <small style={{ color: "#6b7280" }}>
              {rubrosPermitidos ? `Rubros admitidos: ${rubrosPermitidos}` : "Admite todos los rubros"}
            </small>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={20} /></button>
        </div>

        {articulosDisponibles.length === 0 ? (
          <p style={{ textAlign: "center", color: "#6b7280", margin: "2rem 0" }}>
            No hay productos compatibles pendientes por asociar a este depósito.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", overflow: "hidden" }}>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "420px", paddingRight: "0.25rem" }}>
              {filas.map((fila, index) => {
                const opciones = articulosDisponibles.filter(
                  a => a.id_articulo === fila.id_articulo || !seleccionadosIds.includes(a.id_articulo)
                );

                return (
                  <div key={index} style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.85rem", background: "#f9fafb", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        required
                        value={fila.id_articulo}
                        onChange={e => handleActualizarFila(index, "id_articulo", Number(e.target.value))}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#fff" }}
                      >
                        <option value="" disabled>Seleccionar producto...</option>
                        {opciones.map(a => (
                          <option key={a.id_articulo} value={a.id_articulo}>
                            [{a.codigo}] {a.nombre}
                          </option>
                        ))}
                      </select>

                      {filas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEliminarFila(index)}
                          style={{ border: "1px solid #fee2e2", backgroundColor: "#fff", color: "#dc2626", padding: "0.45rem", borderRadius: "0.375rem", cursor: "pointer" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#4b5563", fontWeight: "600" }}>Stock Inicial</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={fila.stock_inicial}
                          onChange={e => handleActualizarFila(index, "stock_inicial", e.target.value)}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "0.25rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#4b5563", fontWeight: "600" }}>Stock Mínimo</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={fila.stock_minimo}
                          onChange={e => handleActualizarFila(index, "stock_minimo", e.target.value)}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "0.25rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#4b5563", fontWeight: "600" }}>Lote Auto</label>
                        <input
                          type="text"
                          readOnly
                          value={fila.numero_lote}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "0.25rem", border: "1px solid #d1d5db", background: "#e5e7eb", fontWeight: "bold", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#4b5563", fontWeight: "600" }}>Vencimiento</label>
                        <input
                          type="date"
                          required
                          value={fila.fecha_vencimiento}
                          onChange={e => handleActualizarFila(index, "fecha_vencimiento", e.target.value)}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "0.25rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={handleAgregarFila}
                disabled={!puedeAgregarMas}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.375rem",
                  border: "1px dashed #365314",
                  backgroundColor: puedeAgregarMas ? "#fff" : "#f3f4f6",
                  color: puedeAgregarMas ? "#365314" : "#9ca3af",
                  cursor: puedeAgregarMas ? "pointer" : "not-allowed",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <Plus size={16} /> Asociar Otro Producto ({filas.length}/{articulosDisponibles.length})
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={onClose} style={{ padding: "0.5rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ padding: "0.5rem 1.25rem", background: "#365314", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: "bold", cursor: "pointer" }}>
                  {loading ? "Guardando..." : "Confirmar Asociación"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}