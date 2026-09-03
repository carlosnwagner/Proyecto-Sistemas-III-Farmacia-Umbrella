import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { Trash2, Plus, X } from "lucide-react";

export default function AjusteStockModal({ idDeposito, productosAsociados = [], isOpen, onClose, onAjusteGuardado }) {
  const [tipoOperacion, setTipoOperacion] = useState("INGRESO");
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (productosAsociados.length > 0) {
        setFilas([{ id_articulo: "", cantidad: "", stock: 0, id_articulo_deposito: null }]);
      } else {
        setFilas([]);
      }
    }
  }, [isOpen, productosAsociados]);

  if (!isOpen) return null;

  const productosSeleccionadosIds = filas.map(f => f.id_articulo).filter(Boolean);
  const puedeAgregarMas = filas.length < productosAsociados.length;
  const esResta = ["EGRESO", "MERMA_ROTURA", "VENCIMIENTO"].includes(tipoOperacion);

  const handleSeleccionarProducto = (index, idArticuloStr) => {
    const artId = Number(idArticuloStr);
    const prod = productosAsociados.find(p => Number(p.id_articulo) === artId);
    const copy = [...filas];
    copy[index] = {
      id_articulo: artId,
      cantidad: copy[index].cantidad || "",
      stock: prod ? prod.stock_actual : 0,
      id_articulo_deposito: prod ? prod.id_articulo_deposito : null
    };
    setFilas(copy);
  };

  const handleCambiarCantidad = (index, valor) => {
    const copy = [...filas];
    copy[index].cantidad = valor;
    setFilas(copy);
  };

  const handleAgregarFila = () => {
    if (puedeAgregarMas) {
      setFilas([...filas, { id_articulo: "", cantidad: "", stock: 0, id_articulo_deposito: null }]);
    }
  };

  const handleEliminarFila = (index) => {
    if (filas.length === 1) {
      setFilas([{ id_articulo: "", cantidad: "", stock: 0, id_articulo_deposito: null }]);
      return;
    }
    setFilas(filas.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const f of filas) {
      if (!f.id_articulo || f.cantidad === "" || Number(f.cantidad) <= 0) {
        alert("Selecciona un producto e ingresa una cantidad positiva mayor a 0.");
        return;
      }

      const cant = Math.abs(Number(f.cantidad));
      if (esResta && cant > f.stock) {
        alert(`No puedes retirar ${cant} unidades porque el stock actual disponible es ${f.stock}.`);
        return;
      }
    }

    setLoading(true);

    try {
      const inserts = filas.map(f => ({
        id_deposito: parseInt(idDeposito),
        id_articulo_deposito: parseInt(f.id_articulo_deposito),
        tipo_movimiento: tipoOperacion,
        cantidad: Math.abs(Number(f.cantidad)) // Siempre positivo en DB
      }));

      const { error } = await supabase.from("movimiento_stock").insert(inserts);
      if (error) throw new Error(error.message);

      alert("¡Ajuste de stock registrado exitosamente!");
      onAjusteGuardado();
      onClose();
    } catch (err) {
      alert("Error al registrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "620px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>Ajuste Masivo de Stock</h2>
            <small style={{ color: "#6b7280" }}>Productos disponibles en depósito: {productosAsociados.length}</small>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={20} /></button>
        </div>

        {productosAsociados.length === 0 ? (
          <p style={{ color: "#6b7280", margin: "1.5rem 0", textAlign: "center" }}>
            No hay productos asociados a este depósito para ajustar.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", overflow: "hidden" }}>
            <div>
              <label style={{ fontWeight: "600", fontSize: "0.85rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>
                Tipo de Operación
              </label>
              <select
                value={tipoOperacion}
                onChange={e => setTipoOperacion(e.target.value)}
                style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#fff" }}
              >
                <option value="INGRESO">Ingreso Manual (+)</option>
                <option value="EGRESO">Egreso Manual (-)</option>
                <option value="MERMA_ROTURA">Merma o Rotura (-)</option>
                <option value="VENCIMIENTO">Vencimiento (-)</option>
              </select>
            </div>

            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "300px", paddingRight: "0.25rem" }}>
              {filas.map((fila, index) => {
                const disponibles = productosAsociados.filter(
                  p => p.id_articulo === fila.id_articulo || !productosSeleccionadosIds.includes(p.id_articulo)
                );

                return (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      required
                      value={fila.id_articulo}
                      onChange={e => handleSeleccionarProducto(index, e.target.value)}
                      style={{ flex: 1, padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                    >
                      <option value="" disabled>Seleccionar producto...</option>
                      {disponibles.map(p => (
                        <option key={p.id_articulo} value={p.id_articulo}>
                          [{p.articulo?.codigo}] {p.articulo?.nombre} (Stock actual: {p.stock_actual})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      required
                      placeholder={esResta ? "A restar" : "A sumar"}
                      value={fila.cantidad}
                      onChange={e => handleCambiarCantidad(index, e.target.value)}
                      style={{ width: "130px", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                    />

                    <button
                      type="button"
                      onClick={() => handleEliminarFila(index)}
                      style={{ padding: "0.55rem", border: "1px solid #fee2e2", backgroundColor: "#fff5f5", color: "#dc2626", borderRadius: "0.375rem", cursor: "pointer" }}
                    >
                      <Trash2 size={16} />
                    </button>
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
                  border: "1px dashed #65482b",
                  backgroundColor: puedeAgregarMas ? "#fff" : "#f3f4f6",
                  color: puedeAgregarMas ? "#65482b" : "#9ca3af",
                  cursor: puedeAgregarMas ? "pointer" : "not-allowed",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <Plus size={16} /> Agregar Producto ({filas.length}/{productosAsociados.length})
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={onClose} style={{ padding: "0.55rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading || filas.length === 0} style={{ padding: "0.55rem 1.25rem", background: "#365314", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: "bold", cursor: "pointer" }}>
                  {loading ? "Guardando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}