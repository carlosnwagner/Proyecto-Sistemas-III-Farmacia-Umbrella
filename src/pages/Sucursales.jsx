import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js"; 
import { Plus, Search } from "lucide-react";

export default function Sucursales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);

  const [sucursales, setSucursales] = useState([]);

  useEffect(() => {
    const loadSucursales = async () => {
      const { data, error: loadError } = await supabase
        .from("sucursal")
        .select("id_sucursal, codigo, descripcion, estado, fecha_registro")
        .order("id_sucursal", { ascending: true });

      if (loadError) {
        showAlert.errorSave(`No se pudieron cargar las sucursales: ${loadError.message}`);
        return;
      }

      setSucursales(data ?? []);
    };

    loadSucursales();
  }, []);

  // Campos alineados con la tabla sucursal de Supabase
  const editFields = [
    { key: "codigo", label: "Código", placeholder: "SUC-001", required: true },
    { key: "descripcion", label: "Descripción", required: true },
    { key: "estado", label: "Estado", type: "checkbox" },
  ];

  // Abrir modal para Crear
  const handleOpenCreate = () => {
    setSelectedSucursal(null);
    setIsModalOpen(true);
  };

  // Abrir modal para Editar
  const handleOpenEdit = (sucursal) => {
    setSelectedSucursal(sucursal);
    setIsModalOpen(true);
  };

  const handleSaveSucursal = async (formData) => {
    const values = {
      codigo: formData.codigo?.trim() ?? "",
      descripcion: formData.descripcion?.trim() ?? "",
      estado: Boolean(formData.estado),
    };

    if (!values.codigo || !values.descripcion) {
      showAlert.errorSave("El código y la descripción son obligatorios.");
      return false;
    }

    let duplicateQuery = supabase
      .from("sucursal")
      .select("id_sucursal")
      .ilike("codigo", values.codigo)
      .limit(1);

    if (selectedSucursal) {
      duplicateQuery = duplicateQuery.neq("id_sucursal", selectedSucursal.id_sucursal);
    }

    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();

    if (duplicateError) {
      showAlert.errorSave(`No se pudo validar el código: ${duplicateError.message}`);
      return false;
    }

    if (duplicate) {
      showAlert.errorSave("Ya existe una sucursal con ese código.");
      return false;
    }

    if (selectedSucursal) {
      // --- MODO EDICIÓN ---
      const { data, error: updateError } = await supabase
        .from("sucursal")
        .update(values)
        .eq("id_sucursal", selectedSucursal.id_sucursal)
        .select("id_sucursal, codigo, descripcion, estado, fecha_registro")
        .single();

      if (updateError) {
        showAlert.errorSave(`No se pudo actualizar la sucursal: ${updateError.message}`);
        return false;
      }

      setSucursales((prev) =>
        prev.map((item) => (item.id_sucursal === data.id_sucursal ? data : item))
      );
      
      showAlert.successSave("¡Sucursal actualizada con éxito!");
    } else {
      // --- MODO CREACIÓN ---
      const { data, error: insertError } = await supabase
        .from("sucursal")
        .insert(values)
        .select("id_sucursal, codigo, descripcion, estado, fecha_registro")
        .single();

      if (insertError) {
        showAlert.errorSave(`No se pudo crear la sucursal: ${insertError.message}`);
        return false;
      }

      setSucursales((prev) => [...prev, data]);
      
      showAlert.successSave("¡Sucursal registrada con éxito!");
    }

    return true;
  };

  // Filtro de búsqueda
  const filteredSucursales = sucursales.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.codigo?.toLowerCase().includes(term) ||
      s.descripcion?.toLowerCase().includes(term)
    );
  });

  // Columnas para la DataTable
  const columns = [
    { header: "ID", accessor: "id_sucursal" },
    { header: "Código", accessor: "codigo" },
    { header: "Descripción", accessor: "descripcion" },
    { header: "Fecha de registro", accessor: "fecha_registro" },
    { header: "Estado", render: (s) => (s.estado ? "Activo" : "Inactivo") }
  ];

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Sucursales</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{sucursales.length} sucursales registradas</p>
        </div>
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
          <Plus size={18} /> Nueva sucursal
        </button>
      </header>

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
      </div>

      <DataTable columns={columns} data={filteredSucursales} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedSucursal ? selectedSucursal.id_sucursal : "nueva-sucursal"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSucursal}
        title={selectedSucursal ? "Editar Sucursal" : "Nueva Sucursal"}
        fields={editFields}
        initialData={selectedSucursal}
      />
    </>
  );
}