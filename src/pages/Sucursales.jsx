import { useState, useEffect } from "react";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";

export default function Sucursales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para controlar el modo de selección y los elementos elegidos
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

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

  // 2. CAMPOS DEL MODAL
  const editFields = [
    { key: "id_sucursal", label: "ID Sucursal", readOnly: true },
    { key: "codigo", label: "Código (Ej: SUC-001)" },
    { key: "descripcion", label: "Descripción" },
    { 
      key: "estado", 
      label: "Estado", 
      type: "select", 
      options: [
        { value: true, label: "Activo" },
        { value: false, label: "Inactivo" }
      ] 
    }
  ];

  const handleOpenCreate = () => {
    setSelectedSucursal(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sucursal) => {
    setSelectedSucursal({
      ...sucursal,
      estado: sucursal.estado === true || sucursal.estado === "Activo" || sucursal.estado === 1
    });
    setIsModalOpen(true);
  };

  // 3. GUARDAR O EDITAR SUCURSAL
  const handleSaveSucursal = async (formData) => {
    const mensajeConfirm = selectedSucursal
      ? "¿Deseas guardar los cambios?"
      : "¿Deseas registrar esta nueva sucursal?";

    if (!window.confirm(mensajeConfirm)) return;

    try {
      const dataToSave = {
        codigo: formData.codigo,
        descripcion: formData.descripcion,
        estado: formData.estado === true || formData.estado === "Activo" || formData.estado === "true"
      };

      if (selectedSucursal) {
        const { data, error } = await supabase
          .from('sucursal')
          .update(dataToSave)
          .eq('id_sucursal', selectedSucursal.id_sucursal)
          .select();

        if (error) throw error;

        if (data) {
          setSucursales((prev) =>
            prev.map((item) => (item.id_sucursal === selectedSucursal.id_sucursal ? data[0] : item))
          );
        }
      } else {
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
    } catch (error) {
      console.error("Error al guardar la sucursal:", error.message);
      alert("Hubo un error al guardar los datos: " + error.message);
    }
  };

  // 4. ELIMINAR INDIVIDUAL O MASIVO
  const handleDeleteSingle = async (id_sucursal) => {
    if (!window.confirm("¿Estás seguro que desea eliminar esta sucursal?")) return;

    try {
      const { error } = await supabase
        .from('sucursal')
        .delete()
        .eq('id_sucursal', id_sucursal);

      if (error) throw error;

      setSucursales((prev) => prev.filter((item) => item.id_sucursal !== id_sucursal));
      setSelectedIds((prev) => prev.filter((id) => id !== id_sucursal));
    } catch (error) {
      console.error("Error al eliminar:", error.message);
      alert("No se pudo eliminar el registro.");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`¿Estás seguro que deseas eliminar las ${selectedIds.length} sucursales seleccionadas?`)) return;

    try {
      const { error } = await supabase
        .from('sucursal')
        .delete()
        .in('id_sucursal', selectedIds);

      if (error) throw error;

      setSucursales((prev) => prev.filter((item) => !selectedIds.includes(item.id_sucursal)));
      setSelectedIds([]);
      setIsSelecting(false);
    } catch (error) {
      console.error("Error en borrado masivo:", error.message);
      alert("No se pudieron eliminar los registros seleccionados.");
    }
  };

  // 5. MANEJO DE CHECKBOXES
  const handleToggleSelectAll = () => {
    const allIds = filteredSucursales.map((s) => s.id_sucursal);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 6. FILTRAR BÚSQUEDA Y ESTADO
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

  const allSelected = filteredSucursales.length > 0 && selectedIds.length === filteredSucursales.length;

  return (
    <>
      {/* HEADER CON "+ Agregar" A LA IZQUIERDA Y "Borrar" A SU DERECHA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Sucursales</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{sucursales.length} sucursales registradas</p>
        </div>
        
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Botón de Agregar primero */}
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

          {/* Botón de Borrar después */}
          <button
            onClick={() => {
              setIsSelecting(!isSelecting);
              if (isSelecting) setSelectedIds([]);
            }}
            style={{
              backgroundColor: isSelecting ? "#fee2e2" : "#ffffff",
              color: isSelecting ? "#991b1b" : "#374151",
              border: "1px solid #d1d5db",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
            }}
          >
            <Trash2 size={18} /> {isSelecting ? "Cancelar Selección" : "Borrar"}
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
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={selectedEstado}
          onChange={(e) => setSelectedEstado(e.target.value)}
          style={{ padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", backgroundColor: "#fff" }}
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
                {isSelecting && <th style={{ padding: "0.75rem 1rem", width: "40px" }}></th>}
                <th style={{ padding: "0.75rem 1rem" }}>ID</th>
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
                  <td colSpan={isSelecting ? 7 : 6} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    No se encontraron sucursales registradas.
                  </td>
                </tr>
              ) : (
                filteredSucursales.map((s) => {
                  const isActivo = s.estado === true || s.estado === "Activo" || s.estado === 1;
                  const isChecked = selectedIds.includes(s.id_sucursal);

                  return (
                    <tr 
                      key={s.id_sucursal} 
                      style={{ 
                        borderBottom: "1px solid #e5e7eb", 
                        backgroundColor: isChecked ? "#f0fdf4" : "#ffffff",
                        transition: "background-color 0.15s ease"
                      }}
                    >
                      {isSelecting && (
                        <td style={{ padding: "1rem" }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleSelectOne(s.id_sucursal)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      )}
                      <td style={{ padding: "1rem", color: "#111827", fontWeight: "500" }}>{s.id_sucursal}</td>
                      <td style={{ padding: "1rem", color: "#111827" }}>{s.codigo}</td>
                      <td style={{ padding: "1rem", color: "#111827", fontWeight: "600" }}>{s.descripcion}</td>
                      <td style={{ padding: "1rem", color: "#6b7280" }}>
                        {s.fecha_registro ? new Date(s.fecha_registro).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span 
                          style={{ 
                            fontSize: "0.75rem", 
                            fontWeight: "700", 
                            padding: "0.2rem 0.75rem", 
                            borderRadius: "1rem", 
                            backgroundColor: isActivo ? "#d1fae5" : "#f3f4f6",
                            color: isActivo ? "#065f46" : "#4b5563",
                            letterSpacing: "0.05em",
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
                          <button
                            onClick={() => handleDeleteSingle(s.id_sucursal)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* BARRA INFERIOR */}
          {isSelecting && (
            <div style={{ padding: "0.75rem 1.5rem", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "#374151", fontWeight: "600" }}>
                  <input 
                    type="checkbox" 
                    onChange={handleToggleSelectAll}
                    checked={allSelected}
                    style={{ cursor: "pointer" }}
                  />
                  Seleccionar todas
                </label>
                <span style={{ fontSize: "0.85rem", color: "#6b7280", marginLeft: "1rem" }}>
                  Seleccionadas: <strong>{selectedIds.length}</strong> de {filteredSucursales.length}
                </span>
              </div>
              
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.length === 0}
                style={{
                  backgroundColor: selectedIds.length > 0 ? "#ef4444" : "#f3f4f6",
                  color: selectedIds.length > 0 ? "#ffffff" : "#9ca3af",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  cursor: selectedIds.length > 0 ? "pointer" : "not-allowed"
                }}
              >
                Eliminar Seleccionadas ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <EditModal
        key={selectedSucursal ? selectedSucursal.id_sucursal : "nueva-sucursal"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSucursal}
        title={selectedSucursal ? "Editar Sucursal" : "Nueva Sucursal"}
        fields={editFields.map((field) =>
          field.key === "id_sucursal" ? { ...field, readOnly: !!selectedSucursal } : field
        )}
        initialData={selectedSucursal}
      />
    </>
  );
}