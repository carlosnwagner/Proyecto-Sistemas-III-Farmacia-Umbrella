import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Search, ArrowLeft, PackageMinus, Plus } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js";

// Componente para la barra de capacidad/stock
function VialGauge({ current, minimum, maxCapacity = 1000 }) {
  const percentage = Math.min(100, Math.max(0, (current / maxCapacity) * 100));

  let fillColor = "#22c55e"; // Verde (Normal)
  if (current === 0) fillColor = "#ef4444"; // Rojo (Sin stock)
  else if (current <= minimum) fillColor = "#f59e0b"; // Naranja (Stock Bajo)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div
        style={{
          width: "60px",
          height: "8px",
          backgroundColor: "#e5e7eb",
          borderRadius: "9999px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: fillColor,
            borderRadius: "9999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
        {current}
      </span>
    </div>
  );
}

// Componente para las etiquetas de estado
function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#dcfce7", color: "#166534" },
    warning: { backgroundColor: "#fef3c7", color: "#92400e" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  };

  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "700",
        display: "inline-flex",
        alignItems: "center",
        textTransform: "uppercase",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

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

export default function InventarioDeposito({ deposito, onBack = () => alert("Volver a depósitos") }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchAjuste, setSearchAjuste] = useState(""); // <-- Estado fundamental para el buscador de ajuste
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [inventory, setInventory] = useState([]);
  const [availableArticles, setAvailableArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("asociar");
  const [selectedItem, setSelectedItem] = useState(null);
  const depositoId = deposito?.id_deposito;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 1. CARGA DEL INVENTARIO DEL DEPÓSITO
  const fetchInventory = useCallback(async () => {
    if (!depositoId) return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("articulo_deposito")
      .select(`
        id_articulo_deposito,
        id_articulo,
        stock_actual,
        stock_minimo,
        estado,
        articulo:articulo (
          codigo,
          nombre,
          rubro:rubro ( nombre )
        )
      `)
      .eq("id_deposito", depositoId)
      .order("id_articulo_deposito", { ascending: true });

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

    const associatedIds = new Set(inventory.map((item) => item.id_articulo));
    const disponibles = (data || []).filter((article) => !associatedIds.has(article.id_articulo));
    
    setAvailableArticles(disponibles);
    setModalMode("asociar");
    setSelectedItem({ 
      id_articulo: "", 
      stock_actual: 0, 
      stock_minimo: 10,
      numero_lote: "",
      fecha_vencimiento: ""
    });
    setIsModalOpen(true);
  }

  // 3. MODAL: AJUSTE DE STOCK
  const openStockAdjustment = () => {
      if (inventory.length === 0) {
        alert("No hay productos en este depósito para ajustar.");
        return;
      }
      const primerProd = inventory[0];
      setSearchAjuste("");
      setDropdownOpen(false);
      setModalMode("ajuste");
      setSelectedItem({
        id_articulo_deposito:"",
        tipo_movimiento: "AJUSTE_AUDITORIA",
        nuevo_stock: primerProd ? primerProd.stock_actual : 0,
      });
      setIsModalOpen(true);
    };
  // 4. MODAL: EDITAR PARÁMETROS
  const handleOpenEdit = (item) => {
    setModalMode("editar");
    setSelectedItem({
      ...item,
      stock_minimo: item.stock_minimo,
      estado: item.estado,
    });
    setIsModalOpen(true);
  };

  // Artículos filtrados para el modal de ajuste
  const articulosFiltradosAjuste = useMemo(() => {
    const term = (searchAjuste || "").toLowerCase();
    return inventory.filter(
      (item) =>
        item.nombre?.toLowerCase().includes(term) ||
        item.codigo?.toLowerCase().includes(term)
    );
  }, [inventory, searchAjuste]);

  const editFields = [
    { key: "codigo", label: "Código", readOnly: true },
    { key: "nombre", label: "Producto", readOnly: true },
    { key: "stock_minimo", label: "Stock Mínimo Permitido", type: "number" },
    { key: "estado", label: "Estado", type: "select", options: [{ value: "Activo", label: "Activo" }, { value: "Inactivo", label: "Inactivo" }] },
  ];

  // 5. GUARDAR DATOS
  const handleSaveItem = async (formData) => {
    let idUsuarioActual = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) idUsuarioActual = user.id;

    // --- MODO 1: ASOCIAR / AGREGAR PRODUCTO ---
    if (modalMode === "asociar") {
      if (!formData.id_articulo) {
        alert("Debes seleccionar un producto.");
        return;
      }

      const stockInicial = parseInt(formData.stock_actual) || 0;
      const stockMinimo = parseInt(formData.stock_minimo) || 0;

      if (stockInicial > 0 && (!formData.numero_lote?.trim() || !formData.fecha_vencimiento)) {
        alert("Si ingresa stock inicial, debe indicar el N° de Lote y Fecha de Vencimiento.");
        return;
      }

      const { data: nuevaAsoc, error: insertError } = await supabase
        .from("articulo_deposito")
        .insert([
          {
            id_articulo: parseInt(formData.id_articulo),
            id_deposito: deposito.id_deposito,
            stock_actual: stockInicial,
            stock_minimo: stockMinimo,
            estado: true,
            fecha_registro: new Date().toISOString(),
          }
        ])
        .select("id_articulo_deposito")
        .single();

      if (insertError) {
        alert("Error al asociar: " + insertError.message);
        return;
      }

      if (stockInicial > 0 && nuevaAsoc) {
        const { data: loteData, error: loteError } = await supabase
          .from("lote")
          .insert([
            {
              id_articulo: parseInt(formData.id_articulo),
              id_deposito: parseInt(deposito.id_deposito),
              numero_lote: (formData.numero_lote || "").trim(),
              fecha_vencimiento: formData.fecha_vencimiento,
              cantidad: stockInicial,
              estado: "Vigente",
              fecha_registro: new Date().toISOString(),
            }
          ])
          .select("id_lote")
          .single();

        if (loteError) {
          console.error("Error al registrar el lote:", loteError);
          alert("Error al registrar el lote en la base de datos: " + loteError.message);
          return;
        }

        const { error: movError } = await supabase
          .from("movimiento_stock")
          .insert([
            {
              id_articulo_deposito: nuevaAsoc.id_articulo_deposito,
              id_lote: loteData ? loteData.id_lote : null,
              id_usuario: idUsuarioActual,
              tipo_movimiento: "INGRESO_INICIAL",
              cantidad: stockInicial,
              fecha_movimiento: new Date().toISOString(),
            }
          ]);

        if (movError) {
          console.error("Error al registrar movimiento_stock:", movError);
          alert("El lote se creó pero falló el movimiento: " + movError.message);
          return;
        }
      }

      alert("¡Producto agregado al depósito con éxito!");
      setIsModalOpen(false);
      await fetchInventory();
      return;
    }

    // --- MODO 2: AJUSTE DE STOCK ---
    if (modalMode === "ajuste") {
      const idRelacion = parseInt(formData.id_articulo_deposito);
      const nuevoStock = parseInt(formData.nuevo_stock);

      if (!idRelacion || isNaN(nuevoStock) || nuevoStock < 0) {
        alert("Seleccione un producto e ingrese un stock válido.");
        return;
      }

      const itemPrevio = inventory.find((i) => i.id_articulo_deposito === idRelacion);
      const stockAnterior = itemPrevio?.stock_actual || 0;
      const diferencia = Math.abs(nuevoStock - stockAnterior);

      const { error: updateStockErr } = await supabase
        .from("articulo_deposito")
        .update({ stock_actual: nuevoStock })
        .eq("id_articulo_deposito", idRelacion);

      if (updateStockErr) {
        alert("Error al actualizar el stock: " + updateStockErr.message);
        return;
      }

      const { error: movErr } = await supabase
        .from("movimiento_stock")
        .insert([
          {
            id_articulo_deposito: idRelacion,
            id_lote: null,
            id_usuario: idUsuarioActual,
            tipo_movimiento: formData.tipo_movimiento || "AJUSTE_AUDITORIA",
            cantidad: diferencia,
            fecha_movimiento: new Date().toISOString(),
          }
        ]);

      if (movErr) {
        console.error("Error en movimiento_stock:", movErr);
        alert("Stock actualizado, pero falló el registro de auditoría: " + movErr.message);
        return;
      }

      alert("¡Ajuste de stock y movimiento guardados correctamente!");
      setIsModalOpen(false);
      await fetchInventory();
      return;
    }

    // --- MODO 3: EDITAR PARÁMETROS ---
    if (modalMode === "editar") {
      const { error: updateError } = await supabase
        .from("articulo_deposito")
        .update({
          stock_minimo: parseInt(formData.stock_minimo) || 0,
          estado: formData.estado === "Activo" || formData.estado === true,
        })
        .eq("id_articulo_deposito", formData.id_articulo_deposito);

      if (updateError) {
        alert("Error al actualizar: " + updateError.message);
        return;
      }

      alert("¡Parámetros actualizados!");
      setIsModalOpen(false);
      await fetchInventory();
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(inventory.map((p) => p.categoria).filter(Boolean));
    return ["Todas", ...Array.from(cats)];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((p) => {
      const matchesSearch = p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const total = inventory.length;
    const stockBajo = inventory.filter((p) => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length;
    const sinStock = inventory.filter((p) => p.stock_actual === 0).length;
    const itemsSaludables = total - stockBajo - sinStock;

    return { total, stockBajo, sinStock, itemsSaludables };
  }, [inventory]);

  const columns = [
    { header: "CÓDIGO", accessor: "codigo" },
    { header: "PRODUCTO", render: (p) => <span style={{ fontWeight: "600", color: "#221C16" }}>{p.nombre}</span> },
    { header: "CATEGORÍA", accessor: "categoria" },
    {
      header: "STOCK ACTUAL",
      render: (p) => (
        <VialGauge current={p.stock_actual} minimum={p.stock_minimo} maxCapacity={1000} />
      ),
    },
    { header: "STOCK MÍNIMO", render: (p) => <span style={{ color: "#7D756D", fontWeight: "600" }}>{p.stock_minimo}</span> },
    {
      header: "ESTADO",
      render: (p) => {
        let variant;
        let label = p.estado;
        
        if (p.estado === "Inactivo") variant = "danger";
        else if (p.stock_actual === 0) { variant = "danger"; label = "Sin Stock"; }
        else if (p.stock_actual <= p.stock_minimo) { variant = "warning"; label = "Stock Bajo"; }
        else variant = "success";

        return <Badge variant={variant}>{label}</Badge>;
      },
    }
  ];

  return (
    <div style={{ padding: "1rem", backgroundColor: "#F7F4EE", minHeight: "100vh" }}>
      <button 
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "transparent", border: "none", color: "#65482b", fontWeight: "600", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}
      >
        <ArrowLeft size={18} /> Volver a Depósitos
      </button>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            Inventario: {deposito?.codigo}
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            {deposito?.descripcion} — {stats.total} productos asociados
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button 
            onClick={openStockAdjustment} 
            style={{ backgroundColor: "#ffffff", color: "#65482b", border: "1px solid #d1d5db", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
          >
            <PackageMinus size={18} /> Ajuste de Stock
          </button>
          <button 
            onClick={openNewAssociation} 
            style={{ backgroundColor: "#4E6B4F", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
          >
            <Plus size={18} /> Agregar Productos
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard title="PRODUCTOS ASOCIADOS" value={stats.total} subtitle="Total en catálogo" />
        <StatCard title="STOCK SALUDABLE" value={stats.itemsSaludables} subtitle="Por encima del mínimo" />
        <StatCard title="STOCK BAJO" value={stats.stockBajo} subtitle="Requieren reposición" alert={stats.stockBajo > 0} />
        <StatCard title="SIN STOCK (QUIEBRE)" value={stats.sinStock} subtitle="Agotados completamente" alert={stats.sinStock > 0} />
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por producto o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", outline: "none", color: "#374151", fontWeight: "500" }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Cargando inventario del depósito...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#991b1b" }}>{error}</div>
      ) : (
        <DataTable columns={columns} data={filteredInventory} onEdit={handleOpenEdit} />
      )}

      {/* 1. Modal Reutilizable para Modificar Parámetros de Stock */}
      {isModalOpen && modalMode === "editar" && (
        <EditModal
          key="modal-editar"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveItem}
          title="Modificar Parámetros de Stock"
          fields={editFields}
          initialData={selectedItem}
        />
      )}

      {/* 2. Modal Nativo para Ajuste de Stock con Buscador Integrado */}
{/* Modal Nativo para Ajuste de Stock con Buscador Tipo Tienda */}
      {isModalOpen && modalMode === "ajuste" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "visible", padding: "1.5rem", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "1.25rem" }}>
              Ajuste de Stock / Movimientos
            </h2>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveItem(selectedItem); }} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              
              {/* Buscador Único Integrado con Desplegable */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", position: "relative" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Producto</label>
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    type="text"
                    placeholder="Escribe el nombre o código del producto..."
                    value={searchAjuste}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchAjuste(e.target.value);
                      setDropdownOpen(true);
                    }}
                    style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.25rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box", fontSize: "0.875rem" }}
                    required
                  />
                </div>

                {/* Lista Flotante de Resultados */}
                {dropdownOpen && (
                  <ul
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      maxHeight: "180px",
                      overflowY: "auto",
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.375rem",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      margin: "0.25rem 0 0",
                      padding: 0,
                      listStyle: "none",
                      zIndex: 20,
                    }}
                  >
                    {articulosFiltradosAjuste.length === 0 ? (
                      <li style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#6b7280", textAlign: "center" }}>
                        No se encontraron productos coincidentes
                      </li>
                    ) : (
                      articulosFiltradosAjuste.map((item) => (
                        <li
                          key={item.id_articulo_deposito}
                          onMouseDown={() => {
                            setSelectedItem({
                              ...selectedItem,
                              id_articulo_deposito: String(item.id_articulo_deposito),
                              nuevo_stock: item.stock_actual,
                            });
                            setSearchAjuste(`[${item.codigo}] ${item.nombre}`);
                            setDropdownOpen(false);
                          }}
                          style={{
                            padding: "0.625rem 1rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            borderBottom: "1px solid #f3f4f6",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            backgroundColor: String(selectedItem?.id_articulo_deposito) === String(item.id_articulo_deposito) ? "#f3f4f6" : "#ffffff",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAF8F4")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = String(selectedItem?.id_articulo_deposito) === String(item.id_articulo_deposito) ? "#f3f4f6" : "#ffffff")}
                        >
                          <span>
                            <strong style={{ color: "#221C16" }}>[{item.codigo}]</strong> {item.nombre}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#7D756D", fontWeight: "600" }}>
                            Stock: {item.stock_actual}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {/* Selector de Tipo de Movimiento */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Tipo de Movimiento</label>
                <select 
                  value={selectedItem?.tipo_movimiento || "AJUSTE_AUDITORIA"}
                  onChange={(e) => setSelectedItem({ ...selectedItem, tipo_movimiento: e.target.value })}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }}
                >
                  <option value="AJUSTE_AUDITORIA">Ajuste por Conteo / Auditoría</option>
                  <option value="MERMA_ROTURA">Merma / Rotura</option>
                  <option value="VENCIMIENTO">Baja por Vencimiento</option>
                  <option value="Ingreso">Ingreso Manual Simple</option>
                  <option value="Egreso">Egreso Manual Simple</option>
                  <option value="Ajuste">Ajuste General</option>
                </select>
              </div>

              {/* Entrada de Stock Físico Real */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Nuevo Stock Físico Real</label>
                <input 
                  type="number" 
                  min="0"
                  value={selectedItem?.nuevo_stock ?? 0}
                  onChange={(e) => setSelectedItem({ ...selectedItem, nuevo_stock: e.target.value })}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#4E6B4F", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Nativo para Agregar Producto con Lote Condicional */}
      {isModalOpen && modalMode === "asociar" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "1.25rem" }}>
              Agregar Producto a {deposito?.codigo}
            </h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveItem(selectedItem); }} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Producto (Catálogo)</label>
                <select 
                  value={selectedItem?.id_articulo || ""} 
                  onChange={(e) => setSelectedItem({ ...selectedItem, id_articulo: e.target.value })}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }}
                  required
                >
                  <option value="" disabled>Seleccione un producto...</option>
                  {availableArticles.map((art) => (
                    <option key={art.id_articulo} value={art.id_articulo}>
                      [{art.codigo}] {art.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Stock Inicial</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selectedItem?.stock_actual ?? 0} 
                    onChange={(e) => setSelectedItem({ ...selectedItem, stock_actual: e.target.value })} 
                    style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }} 
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Stock Mínimo</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selectedItem?.stock_minimo ?? 10} 
                    onChange={(e) => setSelectedItem({ ...selectedItem, stock_minimo: e.target.value })} 
                    style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.875rem" }} 
                  />
                </div>
              </div>

              {/* Condición dinámica: solo se muestra si el stock es mayor a 0 */}
              {Number(selectedItem?.stock_actual) > 0 && (
                <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Datos del Lote Inicial</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151" }}>N° de Lote</label>
                      <input 
                        type="text" 
                        placeholder="Ej. LOT-2026-01" 
                        value={selectedItem?.numero_lote || ""} 
                        onChange={(e) => setSelectedItem({ ...selectedItem, numero_lote: e.target.value })} 
                        style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.85rem" }} 
                        required
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151" }}>Vencimiento</label>
                      <input 
                        type="date" 
                        value={selectedItem?.fecha_vencimiento || ""} 
                        onChange={(e) => setSelectedItem({ ...selectedItem, fecha_vencimiento: e.target.value })} 
                        style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box", fontSize: "0.85rem" }} 
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#4E6B4F", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Agregar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}