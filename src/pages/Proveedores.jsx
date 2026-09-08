import { useState, useEffect, useMemo } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search } from "lucide-react";
import { supabase } from '../lib/supabase.js';
import { showAlert } from "../lib/alerts.js";
// SERVICIOS BACKEND
import { createProveedor, updateProveedor } from '../services/proveedores.js';

export default function Proveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [proveedores, setProveedores] = useState([]);

  // Estado local para notificaciones flotantes (Toasts)
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  // CARGA DE DATOS DESDE SUPABASE
  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    const { data, error } = await supabase
      .from('proveedor')
      .select('*')
      .order('razon_social', { ascending: true });
    
    if (error) console.error("Error al traer proveedores:", error);
    else setProveedores(data || []);
  };

  // Configuración de Campos de Modal (CUIT editable, se quitó el readOnly)
  const editFields = useMemo(() => [
    { key: "razon_social", label: "Razón Social" },
    { 
      key: "identificacion_fiscal", 
      label: "Identificación Fiscal (CUIT)"
    },
    { key: "datos_comerciales", label: "Condiciones Comerciales" },
    { key: "datos_contacto", label: "Datos de Contacto (Teléfono/Email)" },
  ], []);

  const handleOpenCreate = () => {
    setSelectedProveedor(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proveedor) => {
    setSelectedProveedor(proveedor);
    setIsModalOpen(true);
  };

  // Validación estricta de CUIT de Argentina (Algoritmo Módulo 11)
  const validarCuitCuil = (cuit) => {
    if (!cuit) return false;
    const limpio = cuit.toString().replace(/[^0-9]/g, "");
    if (limpio.length !== 11) return false;

    const tipo = limpio.substr(0, 2);
    if (tipo !== "20" && tipo !== "23" && tipo !== "24" && tipo !== "27" && tipo !== "30" && tipo !== "33" && tipo !== "34") {
      return false;
    }

    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += parseInt(limpio[i]) * mult[i];
    }

    let mod = 11 - (suma % 11);
    let digitoVerificador = mod === 11 ? 0 : mod === 10 ? 9 : mod;

    return digitoVerificador === parseInt(limpio[10]);
  };

  // GUARDADO DE DATOS CON VALIDACIÓN DE CUIT
  const handleSaveProveedor = async (formData) => {
    // Validar formato del CUIT antes de enviar al backend
    if (!validarCuitCuil(formData.identificacion_fiscal)) {
      alert("El CUIT ingresado no es válido. Debe contener 11 dígitos numéricos y cumplir con el formato oficial de Argentina.");
      return;
    }

    // payload
    const payload = {
      razon_social: formData.razon_social,
      identificacion_fiscal: formData.identificacion_fiscal,
      datos_comerciales: formData.datos_comerciales,
      datos_contacto: formData.datos_contacto
    };

    if (selectedProveedor) {
  // --- MODO EDICIÓN ---
  const { error } = await updateProveedor(selectedProveedor.id_proveedor, payload);
  
  if (error) {
    showAlert.errorSave(`Error: ${error.message}`);
  } else {
    showAlert.successSave("¡Proveedor actualizado con éxito!");
    fetchProveedores();
    setIsModalOpen(false);
  }
} else {
  // --- MODO CREACIÓN ---
  const { error } = await createProveedor(payload);
  
  if (error) {
    showAlert.errorSave(`Error: ${error.message}`);
  } else {
    showAlert.successSave("¡Proveedor registrado con éxito!");
    fetchProveedores();
    setIsModalOpen(false);
  }
}

   
  };

  const filteredProveedores = proveedores.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.razon_social?.toLowerCase().includes(term) ||
      p.identificacion_fiscal?.toLowerCase().includes(term) ||
      p.datos_contacto?.toLowerCase().includes(term)
    );
  });

  const columns = [
    { header: "ID", accessor: "id_proveedor" },
    {
      header: "RAZÓN SOCIAL",
      render: (p) => <span style={{ fontWeight: "600" }}>{p.razon_social}</span>,
    },
    { header: "CUIT", accessor: "identificacion_fiscal" },
    { header: "COMERCIAL", accessor: "datos_comerciales" },
    { header: "CONTACTO", accessor: "datos_contacto" },
    { 
      header: "FECHA REGISTRO", 
      render: (p) => <span>{p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString() : '-'}</span> 
    },
  ];

  return (
    <div style={{ padding: "1rem" }}>
      {/* Toast Flotante Custom */}
      {toast.show && (
        <div 
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            color: "#ffffff",
            backgroundColor: toast.type === "error" ? "#ef4444" : "#10b981",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            fontWeight: "600",
            fontSize: "0.875rem",
            transition: "all 0.3s ease"
          }}
        >
          {toast.message}
        </div>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Proveedores</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{proveedores.length} proveedores registrados</p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nuevo proveedor
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por Razón Social, CUIT o Contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredProveedores} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedProveedor ? selectedProveedor.id_proveedor : "nuevo-proveedor"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProveedor}
        title={selectedProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
        fields={editFields}
        initialData={selectedProveedor}
      />
    </div>
  );
}