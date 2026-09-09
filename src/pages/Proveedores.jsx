import { useState, useEffect, useMemo } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search } from "lucide-react";
import { supabase } from '../lib/supabase.js';
import { showAlert } from "../lib/alerts.js";

// SERVICIOS BACKEND
import { createProveedor } from '../services/proveedores.js';

export default function Proveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroComercial, setFiltroComercial] = useState("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [proveedores, setProveedores] = useState([]);

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

  // Formateador automático en tiempo real para el CUIT
  const formatearCuitEnVivo = (valor) => {
    if (!valor) return "";
    const limpio = valor.toString().replace(/\D/g, "").slice(0, 11);
    
    if (limpio.length <= 2) {
      return limpio;
    } else if (limpio.length <= 10) {
      return `${limpio.slice(0, 2)}-${limpio.slice(2)}`;
    } else {
      return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10, 11)}`;
    }
  };

  // Configuración dinámica de Campos de Modal
  const editFields = useMemo(() => {
    const baseFields = [
      { key: "razon_social", label: "Razón Social" },
      { 
        key: "identificacion_fiscal", 
        label: "Identificación Fiscal (CUIT)",
        placeholder: "Ej: 30-71000000-6",
        onChange: (e, setFormData, formData) => {
          const valorFormateado = formatearCuitEnVivo(e.target.value);
          setFormData({ ...formData, identificacion_fiscal: valorFormateado });
        }
      },
      { 
        key: "datos_comerciales", 
        label: "Condiciones Comerciales",
        type: "select",
        options: [
          { value: "Responsable Inscripto", label: "Responsable Inscripto" },
          { value: "Monotributista", label: "Monotributista" },
          { value: "Exento", label: "Exento" },
          { value: "Consumidor Final", label: "Consumidor Final" }
        ]
      },
      { key: "datos_contacto", label: "Datos de Contacto (Teléfono/Email)" },
    ];

    if (selectedProveedor) {
      baseFields.push({
        key: "estado",
        label: "Estado",
        type: "select",
        options: [
          { value: true, label: "Activo" },
          { value: false, label: "Inactivo" }
        ]
      });
    }

    return baseFields;
  }, [selectedProveedor]);

  const handleOpenCreate = () => {
    setSelectedProveedor(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proveedor) => {
    setSelectedProveedor({
      ...proveedor,
      identificacion_fiscal: formatearCuitEnVivo(proveedor.identificacion_fiscal),
      estado: proveedor.estado === true || proveedor.estado === "Activo" || proveedor.estado === 1
    });
    setIsModalOpen(true);
  };

  // Validación estricta y segura de CUIT de Argentina (Módulo 11)
  const validarCuitCuil = (cuit) => {
    if (!cuit) return false;
    const limpio = cuit.toString().replace(/\D/g, "");
    if (limpio.length !== 11) return false;

    const tipo = limpio.slice(0, 2);
    if (!["20", "23", "24", "27", "30", "33", "34"].includes(tipo)) {
      return false;
    }

    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += parseInt(limpio[i], 10) * mult[i];
    }

    let mod = 11 - (suma % 11);
    let digitoVerificador = mod === 11 ? 0 : mod === 10 ? 9 : mod;

    return digitoVerificador === parseInt(limpio[10], 10);
  };

  // GUARDADO DIRECTO A SUPABASE CON VALIDACIÓN INTELIGENTE EN EDICIÓN
  const handleSaveProveedor = async (formData) => {
    const cuitFormateado = formatearCuitEnVivo(formData.identificacion_fiscal);
    
    const esMismoCuit = selectedProveedor && selectedProveedor.identificacion_fiscal === cuitFormateado;
    
    if (!esMismoCuit) {
      const cuitValido = validarCuitCuil(cuitFormateado);
      if (!cuitValido) {
        showAlert.errorSave("El CUIT ingresado no es válido. Debe contener 11 dígitos numéricos y cumplir con el formato oficial de Argentina.");
        return; 
      }
    }

    if (selectedProveedor) {
      // --- MODO EDICIÓN ---
      const estadoBooleano = formData.estado === true || formData.estado === "Activo" || formData.estado === "true";

      const { error } = await supabase
        .from('proveedor')
        .update({
          razon_social: formData.razon_social,
          identificacion_fiscal: cuitFormateado,
          datos_comerciales: formData.datos_comerciales,
          datos_contacto: formData.datos_contacto,
          estado: estadoBooleano
        })
        .eq('id_proveedor', selectedProveedor.id_proveedor);
      
      if (error) {
        showAlert.errorSave(`Error al actualizar: ${error.message}`);
      } else {
        showAlert.successSave("¡Proveedor actualizado con éxito!");
        fetchProveedores();
        setIsModalOpen(false);
      }
    } else {
      // --- MODO CREACIÓN ---
      const payload = {
        razon_social: formData.razon_social,
        identificacion_fiscal: cuitFormateado,
        datos_comerciales: formData.datos_comerciales,
        datos_contacto: formData.datos_contacto,
        estado: true
      };

      const { error } = await createProveedor(payload);
      
      if (error) {
        showAlert.errorSave(`Error al registrar: ${error.message}`);
      } else {
        showAlert.successSave("¡Proveedor registrado con éxito!");
        fetchProveedores();
        setIsModalOpen(false);
      }
    }
  };

  const filteredProveedores = proveedores.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      p.razon_social?.toLowerCase().includes(term) ||
      p.identificacion_fiscal?.toLowerCase().includes(term) ||
      p.datos_contacto?.toLowerCase().includes(term);

    const isActivo = p.estado === true || p.estado === "Activo" || p.estado === 1;
    
    let matchEstado = true;
    if (filtroEstado === "activos") matchEstado = isActivo;
    if (filtroEstado === "inactivos") matchEstado = !isActivo;

    let matchComercial = true;
    if (filtroComercial !== "todos") {
      matchComercial = p.datos_comerciales === filtroComercial;
    }

    return matchSearch && matchEstado && matchComercial;
  });

  const columns = [
    {
      header: "RAZÓN SOCIAL",
      render: (p) => <span style={{ fontWeight: "600" }}>{p.razon_social}</span>,
    },
    { header: "CUIT", accessor: "identificacion_fiscal" },
    { header: "COMERCIAL", accessor: "datos_comerciales" },
    { header: "CONTACTO", accessor: "datos_contacto" },
    { 
      header: "ESTADO", 
      render: (p) => {
        const isActivo = p.estado === true || p.estado === "Activo" || p.estado === 1;
        return (
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
        );
      } 
    },
    { 
      header: "FECHA REGISTRO", 
      render: (p) => <span>{p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString() : '-'}</span> 
    },
  ];

  return (
    <div style={{ padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Proveedores</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{filteredProveedores.length} de {proveedores.length} proveedores mostrados</p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nuevo proveedor
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "250px" }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por Razón Social, CUIT o Contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", backgroundColor: "#fff", cursor: "pointer", color: "#374151" }}
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>

        <select
          value={filtroComercial}
          onChange={(e) => setFiltroComercial(e.target.value)}
          style={{ padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", backgroundColor: "#fff", cursor: "pointer", color: "#374151" }}
        >
          <option value="todos">Todas las condiciones</option>
          <option value="Responsable Inscripto">Responsable Inscripto</option>
          <option value="Monotributista">Monotributista</option>
          <option value="Exento">Exento</option>
          <option value="Consumidor Final">Consumidor Final</option>
        </select>
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