import { useState, useEffect } from "react";
import { Plus, Search, Edit2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";

export default function Sucursales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sucursalEditando, setSucursalEditando] = useState(null);
  
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados del formulario
  const [codigoAuto, setCodigoAuto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState(true);

  // 1. OBTENER SUCURSALES DESDE SUPABASE
  const fetchSucursales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sucursal') 
        .select('*');

      if (error) throw error;
      if (data) setSucursales(data);
    } catch (error) {
      console.error("Error al cargar las sucursales:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSucursales();
  }, []);

  // Función para calcular automáticamente el siguiente código correlativo (ej. SUC-015)
  const calcularSiguienteCodigoSucursal = async () => {
    const { data } = await supabase.from("sucursal").select("codigo");
    if (!data || data.length === 0) {
      setCodigoAuto("SUC-001");
      return;
    }

    let maxNum = 0;
    data.forEach(item => {
      if (item.codigo) {
        const limpio = item.codigo.replace(/\s+/g, "").toUpperCase();
        const parts = limpio.split("-");
        if (parts.length >= 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const siguiente = String(maxNum + 1).padStart(3, "0");
    setCodigoAuto(`SUC-${siguiente}`);
  };

  const handleOpenCreate = async () => {
    setSucursalEditando(null);
    await calcularSiguienteCodigoSucursal();
    setDescripcion("");
    setEstado(true); // Activo por defecto al crear (oculto en el modal de alta)
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sucursal) => {
    setSucursalEditando(sucursal);
    setCodigoAuto(sucursal.codigo);
    setDescripcion(sucursal.descripcion);
    setEstado(sucursal.estado === true || sucursal.estado === "Activo" || sucursal.estado === 1);
    setIsModalOpen(true);
  };

  // 3. GUARDAR O EDITAR SUCURSAL
  const handleSaveSucursal = async (e) => {
    e.preventDefault();
    const mensajeConfirm = sucursalEditando
      ? "¿Deseas guardar los cambios?"
      : "¿Deseas registrar esta nueva sucursal?";

    if (!window.confirm(mensajeConfirm)) return;

    try {
      const dataToSave = {
        descripcion: descripcion.trim(),
        estado: estado
      };

      if (sucursalEditando) {
        const { data, error } = await supabase
          .from('sucursal')
          .update(dataToSave)
          .eq('id_sucursal', sucursalEditando.id_sucursal)
          .select();

        if (error) throw error;

        if (data) {
          setSucursales((prev) =>
            prev.map((item) => (item.id_sucursal === sucursalEditando.id_sucursal ? data[0] : item))
          );
        }
      } else {
        dataToSave.codigo = codigoAuto;
        const { data, error } = await supabase
          .from('sucursal')
          .insert([
            { 
              ...dataToSave, 
              fecha_registro: new Date().toISOString() 
            }
          ])
          .select();

        if (error) throw error;

        if (data) {
          setSucursales((prev) => [...prev, data[0]]);
        }
      }
      
      setIsModalOpen(false);
      fetchSucursales();
    } catch (error) {
      console.error("Error al guardar la sucursal:", error.message);
      alert("Hubo un error al guardar los datos: " + error.message);
    }
  };

  // 4. FILTRAR BÚSQUEDA Y ESTADO
  const filteredSucursales = sucursales.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      s.codigo?.toLowerCase().includes(term) ||
      s.descripcion?.toLowerCase().includes(term);
    
    const isActivo = s.estado === true || s.estado === "Activo" || s.estado === 1;
    const estadoTexto = isActivo ? "Activo" : "Inactivo";
    const matchesEstado = 
      selectedEstado === "Todos" || estadoTexto === selectedEstado;

    return matchesSearch && matchesEstado;
  });

  return (
    <>
      {/* HEADER */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Sucursales</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{sucursales.length} sucursales registradas</p>
        </div>
        
        <div>
          <button
            onClick={handleOpenCreate}
            style={{
              backgroundColor: "#65482b",
              color: "#ffffff",
              border: "none",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
            }}
          >
            <Plus size={18} /> Agregar
          </button>
        </div>
      </header>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }}
          />
        </div>
        <select
          value={selectedEstado}
          onChange={(e) => setSelectedEstado(e.target.value)}
          style={{ padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
        >
          <option value="Todos">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>

      {/* TABLA */}
      {loading ? (
        <p style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>Cargando sucursales...</p>
      ) : (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
            <thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#4b5563", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <tr>
                <th style={{ padding: "0.75rem 1rem" }}>Código</th>
                <th style={{ padding: "0.75rem 1rem" }}>Descripción</th>
                <th style={{ padding: "0.75rem 1rem" }}>Fecha de Registro</th>
                <th style={{ padding: "0.75rem 1rem" }}>Estado</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSucursales.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    No se encontraron sucursales registradas.
                  </td>
                </tr>
              ) : (
                filteredSucursales.map((s) => {
                  const isActivo = s.estado === true || s.estado === "Activo" || s.estado === 1;

                  return (
                    <tr 
                      key={s.id_sucursal} 
                      style={{ 
                        borderBottom: "1px solid #e5e7eb", 
                        backgroundColor: "#ffffff",
                        transition: "background-color 0.15s ease"
                      }}
                    >
                      <td style={{ padding: "1rem", color: "#111827", fontWeight: "600" }}>{s.codigo}</td>
                      <td style={{ padding: "1rem", color: "#111827" }}>{s.descripcion}</td>
                      <td style={{ padding: "1rem", color: "#6b7280" }}>
                        {s.fecha_registro ? new Date(s.fecha_registro).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span 
                          style={{ 
                            fontSize: "0.68rem", 
                            fontWeight: "700", 
                            letterSpacing: "0.05em",
                            padding: "0.15rem 0.5rem", 
                            borderRadius: "4px", 
                            backgroundColor: isActivo ? "#f0fdf4" : "#fef2f2", 
                            color: isActivo ? "#15803d" : "#b91c1c",
                            border: `1px solid ${isActivo ? "#bbf7d0" : "#fecaca"}`,
                            display: "inline-block"
                          }}
                        >
                          {isActivo ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", alignItems: "center" }}>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#65482b" }}
                            title="Modificar"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL NATIVO PERSONALIZADO */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#fff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.3rem" }}>
              {sucursalEditando ? "Editar Sucursal" : "Nueva Sucursal"}
            </h2>

            <form onSubmit={handleSaveSucursal} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>
                  Código (Autogenerado)
                </label>
                <input
                  type="text"
                  value={codigoAuto}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "0.55rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    boxSizing: "border-box",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    fontWeight: "bold",
                    cursor: "not-allowed"
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>Descripción *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sucursal Central - Av. San Martín 300"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>

              {/* ESTADO: Solo visible cuando se está EDITANDO una sucursal existente */}
              {sucursalEditando && (
                <div>
                  <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>Estado *</label>
                  <select
                    value={estado ? "true" : "false"}
                    onChange={(e) => setEstado(e.target.value === "true")}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#fff" }}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.55rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "500" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.55rem 1.25rem", background: "#65482b", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: "bold", cursor: "pointer" }}
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}