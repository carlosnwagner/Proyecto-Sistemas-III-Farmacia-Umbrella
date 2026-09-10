import { useEffect, useState } from "react";
import { FileText, Plus, Search, RefreshCw, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import {
  createFacturaProveedor,
  ALICUOTAS_IVA,
  ESTADOS_FACTURA,
  formatNumeroComprobante,
  downloadFacturaPdf,
  getFacturaDetalle,
  getFacturasProveedores,
  TIPOS_COMPROBANTE,
  TIPOS_FACTURA,
} from "../services/facturasProveedores.js";

const initialForm = {
  tipo_comprobante: "Factura",
  tipo_factura: "",
  id_proveedor: "",
  id_orden_compra: "",
  punto_venta: "",
  numero_comprobante: "",
  fecha: new Date().toISOString().split("T")[0],
  subtotal: "",
  iva: "",
  conceptos_exentos: "0",
  percepcion_iva: "0",
  percepcion_iibb: "0",
};

const currency = (value) =>
  `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

export default function FacturasProveedores() {
  const [facturas, setFacturas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [detallesOrden, setDetallesOrden] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [detalleFactura, setDetalleFactura] = useState([]);
  const [loadingFacturaDetalle, setLoadingFacturaDetalle] = useState(false);
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    const [facturasResult, proveedoresResult, ordenesResult] =
      await Promise.all([
        getFacturasProveedores(),
        supabase
          .from("proveedor")
          .select("id_proveedor, razon_social, identificacion_fiscal")
          .eq("estado", true)
          .order("razon_social"),
        supabase
          .from("orden_compra")
          .select("id_orden_compra, numero_orden, id_proveedor, estado")
          .order("fecha_emision", { ascending: false }),
      ]);

    if (facturasResult.error)
      setError(
        `No se pudieron cargar las facturas: ${facturasResult.error.message}`,
      );
    else {
      // Normalizamos "Pagada Total" a "Pagada" para mantener coherencia
      const normalizadas = (facturasResult.data || []).map(f => ({
        ...f,
        estado: f.estado === "Pagada Total" ? "Pagada" : f.estado
      }));
      setFacturas(normalizadas);
    }
    setProveedores(proveedoresResult.data || []);
    setOrdenes(ordenesResult.data || []);
    if (proveedoresResult.error || ordenesResult.error) {
      setError(
        "No se pudieron cargar todos los datos de apoyo del formulario.",
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    Promise.resolve().then(loadData);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleVerDetalle(factura) {
    setFacturaDetalle(factura);
    setDetalleFactura([]);
    setLoadingFacturaDetalle(true);
    const result = await getFacturaDetalle(factura.id_factura_proveedor);
    if (result.error)
      setError(`No se pudo cargar el detalle: ${result.error.message}`);
    else setDetalleFactura(result.data);
    setLoadingFacturaDetalle(false);
  }

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const subtotalDetalle = detallesOrden.reduce(
    (sum, detalle) =>
      sum +
      Number(detalle.cantidad || 0) * Number(detalle.precio_unitario || 0),
    0,
  );
  const ivaCalculado = detallesOrden.reduce(
    (sum, detalle) =>
      sum +
      (Number(detalle.cantidad || 0) *
        Number(detalle.precio_unitario || 0) *
        Number(detalle.tasa_iva || 0)) /
        100,
    0,
  );
  const exentosCalculado = detallesOrden.reduce((sum, detalle) => {
    const importeLinea =
      Number(detalle.cantidad || 0) * Number(detalle.precio_unitario || 0);
    return Number(detalle.tasa_iva || 0) === 0 ? sum + importeLinea : sum;
  }, 0);
  const tieneDetalles = detallesOrden.length > 0;
  const exentosFinal = tieneDetalles
    ? exentosCalculado
    : Number(form.conceptos_exentos || 0);
  const total = ["subtotal", "iva", "percepcion_iva", "percepcion_iibb"].reduce(
    (sum, field) => sum + Number(form[field] || 0),
    0,
  );
  const ivaFinal = tieneDetalles ? ivaCalculado : Number(form.iva || 0);
  const subtotalFinal = tieneDetalles
    ? subtotalDetalle
    : Number(form.subtotal || 0);
  const totalCalculado = Number(
    (
      subtotalFinal +
      ivaFinal +
      Number(form.percepcion_iva || 0) +
      Number(form.percepcion_iibb || 0)
    ).toFixed(2),
  );

  const ordenesDisponibles = form.id_proveedor
    ? ordenes.filter(
        (orden) =>
          String(orden.id_proveedor) === String(form.id_proveedor) &&
          orden.estado !== "Borrador" &&
          orden.estado !== "Cancelada",
      )
    : [];

  async function handleOrdenChange(value) {
    updateField("id_orden_compra", value);
    setDetallesOrden([]);
    if (!value) return;
    setLoadingDetalle(true);
    const { data, error: detalleError } = await supabase
      .from("detalle_orden_compra")
      .select(
        "id_detalle_orden, id_articulo, cantidad_solicitada, cantidad_recibida, precio_unitario, articulo:id_articulo(nombre)",
      )
      .eq("id_orden_compra", Number(value));
    if (detalleError)
      setError(
        `No se pudieron cargar los productos de la orden: ${detalleError.message}`,
      );
    else {
      const detalles = (data || []).map((detalle) => ({
        ...detalle,
        cantidad: detalle.cantidad_recibida || 0,
        precio_unitario: detalle.precio_unitario || 0,
        tasa_iva: 21,
      }));
      setDetallesOrden(detalles);
      updateField(
        "subtotal",
        detalles
          .reduce(
            (sum, detalle) =>
              sum + Number(detalle.cantidad) * Number(detalle.precio_unitario),
            0,
          )
          .toFixed(2),
      );
    }
    setLoadingDetalle(false);
  }

  const agregarDetalleManual = () => {
    setDetallesOrden((current) => [
      ...current,
      {
        id_detalle_orden: null,
        id_articulo: null,
        descripcion: "",
        cantidad: 1,
        precio_unitario: 0,
        tasa_iva: 21,
      },
    ]);
  };

  const eliminarDetalle = (index) => {
    setDetallesOrden((current) =>
      current.filter((_, detalleIndex) => detalleIndex !== index),
    );
  };

  const updateDetalle = (index, field, value) => {
    const detalles = [...detallesOrden];
    detalles[index] = { ...detalles[index], [field]: value };
    setDetallesOrden(detalles);
    if (field === "cantidad" || field === "precio_unitario") {
      updateField(
        "subtotal",
        detalles
          .reduce(
            (sum, detalle) =>
              sum +
              Number(detalle.cantidad || 0) *
                Number(detalle.precio_unitario || 0),
            0,
          )
          .toFixed(2),
      );
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    const result = await createFacturaProveedor({
      ...form,
      conceptos_exentos: exentosFinal.toFixed(2),
      iva: ivaFinal.toFixed(2),
      importe_total: totalCalculado,
      detalle: detallesOrden,
    });
    if (result.error) {
      setFieldErrors(result.error.fieldErrors || {});
      setError(result.error.message);
    } else {
      setSuccess("Factura registrada correctamente.");
      setForm({
        ...initialForm,
        fecha: new Date().toISOString().split("T")[0],
      });
      setDetallesOrden([]);
      setLoadingDetalle(false);
      setModalRegistroAbierto(false);
      await loadData();
    }
    setSaving(false);
  }

  const facturasFiltradas = facturas.filter((factura) => {
    const query = searchTerm.toLowerCase();
    const matchesText = [
      factura.numero_comprobante,
      formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante),
      factura.tipo_comprobante,
      factura.proveedor?.razon_social,
      factura.orden_compra?.numero_orden,
    ].some((value) => value?.toLowerCase().includes(query));
    return (
      matchesText &&
      (estadoFiltro === "Todos" || factura.estado === estadoFiltro)
    );
  });

  const BadgeEstado = ({ estado }) => {
    const colores = {
      Pendiente: { bg: "#e0f2fe", text: "#075985" },
      "Pagada Parcial": { bg: "#dcfce7", text: "#166534" },
      Pagada: { bg: "#166534", text: "#ffffff" },
      Anulada: { bg: "#fee2e2", text: "#b91c1c" },
      Cancelada: { bg: "#fee2e2", text: "#b91c1c" },
    };
    const c = colores[estado] || { bg: "#f3f4f6", text: "#4b5563" };
    return (
      <span
        style={{
          backgroundColor: c.bg,
          color: c.text,
          padding: "0.25rem 0.625rem",
          borderRadius: "9999px",
          fontSize: "0.75rem",
          fontWeight: "600",
          whiteSpace: "nowrap",
        }}
      >
        {estado}
      </span>
    );
  };

  const inputStyle = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
    fontSize: "0.875rem",
    outline: "none",
    backgroundColor: "#fff",
  };

  const labelStyle = {
    display: "block",
    color: "#374151",
    fontWeight: "600",
    fontSize: "0.875rem",
    marginBottom: "0.375rem",
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: "700",
              color: "#111827",
              margin: 0,
            }}
          >
            Facturas de proveedores
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            Registrar comprobantes y consultar saldos pendientes
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar facturas"
            style={{
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: refreshing ? "wait" : "pointer",
            }}
          >
            <RefreshCw size={16} />{" "}
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={() => setModalRegistroAbierto(true)}
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
            <Plus size={18} /> Registrar factura
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {success}
        </div>
      )}

      {/* Barra de Filtros y Búsqueda Principal */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
            }}
          />
          <input
            type="text"
            placeholder="Buscar por comprobante, proveedor u orden..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.625rem 0.625rem 0.625rem 2.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              boxSizing: "border-box",
              backgroundColor: "#fff",
              outline: "none",
            }}
          />
        </div>
        <div>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            style={{
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              fontWeight: "600",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="Todos">Todos los estados</option>
            {ESTADOS_FACTURA.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando facturas...</p>
      ) : facturasFiltradas.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "2.5rem",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <FileText size={36} color="#8a7a6c" />
          <p>No hay facturas que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.875rem",
            }}
          >
            <thead
              style={{
                backgroundColor: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <tr>
                {[
                  "Comprobante",
                  "Proveedor",
                  "Fecha",
                  "Orden",
                  "Total",
                  "Saldo",
                  "Estado",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "0.75rem",
                      color: "#6b7280",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map((factura) => (
                <tr
                  key={factura.id_factura_proveedor}
                  onClick={() => handleVerDetalle(factura)}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "0.75rem" }}>
                    <strong style={{ color: "#111827" }}>
                      {factura.tipo_comprobante} {factura.tipo_factura || ""}
                    </strong>
                    <br />
                    <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                      {formatNumeroComprobante(
                        factura.punto_venta,
                        factura.numero_comprobante,
                      )}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {factura.proveedor?.razon_social || "-"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>{factura.fecha}</td>
                  <td style={{ padding: "0.75rem" }}>
                    {factura.orden_compra?.numero_orden || "Sin orden"}
                  </td>
                  <td style={{ padding: "0.75rem", fontWeight: "600" }}>
                    {currency(factura.importe_total)}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      fontWeight: "600",
                      color:
                        factura.saldo_pendiente > 0 ? "#b45309" : "#166534",
                    }}
                  >
                    {currency(factura.saldo_pendiente)}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <BadgeEstado estado={factura.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para Registrar Factura */}
      {modalRegistroAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "0.75rem",
              padding: "2rem",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2
                style={{
                  color: "#111827",
                  fontSize: "1.25rem",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Plus size={18} color="#65482b" /> Registrar factura
              </h2>
              <button
                type="button"
                onClick={() => setModalRegistroAbierto(false)}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <label style={labelStyle}>Punto de venta *</label>
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    step="1"
                    value={form.punto_venta}
                    onChange={(e) => updateField("punto_venta", e.target.value)}
                    placeholder="00001"
                    style={inputStyle}
                    required
                  />
                  {fieldErrors.punto_venta && (
                    <small style={{ color: "#b91c1c" }}>
                      {fieldErrors.punto_venta}
                    </small>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Número *</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{1,8}"
                    value={form.numero_comprobante}
                    onChange={(e) =>
                      updateField(
                        "numero_comprobante",
                        e.target.value.replace(/\D/g, "").slice(0, 8),
                      )
                    }
                    placeholder="00001234"
                    style={inputStyle}
                    required
                  />
                  {fieldErrors.numero_comprobante && (
                    <small style={{ color: "#b91c1c" }}>
                      {fieldErrors.numero_comprobante}
                    </small>
                  )}
                  <small
                    style={{
                      display: "block",
                      color: "#6b7280",
                      marginTop: "0.25rem",
                    }}
                  >
                    Comprobante:{" "}
                    {formatNumeroComprobante(
                      form.punto_venta,
                      form.numero_comprobante,
                    )}
                  </small>
                </div>
                <div>
                  <label style={labelStyle}>Tipo de comprobante *</label>
                  <select
                    value={form.tipo_comprobante}
                    onChange={(e) =>
                      updateField("tipo_comprobante", e.target.value)
                    }
                    style={inputStyle}
                    required
                  >
                    {TIPOS_COMPROBANTE.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo de factura *</label>
                  <select
                    value={form.tipo_factura}
                    onChange={(e) => updateField("tipo_factura", e.target.value)}
                    style={inputStyle}
                    required
                  >
                    <option value="">Seleccionar letra</option>
                    {TIPOS_FACTURA.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Proveedor *</label>
                  <select
                    value={form.id_proveedor}
                    onChange={(e) => {
                      updateField("id_proveedor", e.target.value);
                      updateField("id_orden_compra", "");
                      setDetallesOrden([]);
                    }}
                    style={inputStyle}
                    required
                  >
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.id_proveedor} value={p.id_proveedor}>
                        {p.razon_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Orden de compra</label>
                  <select
                    value={form.id_orden_compra}
                    onChange={(e) => handleOrdenChange(e.target.value)}
                    style={inputStyle}
                    disabled={!form.id_proveedor || loadingDetalle}
                  >
                    <option value="">Sin asociación</option>
                    {ordenesDisponibles.map((orden) => (
                      <option
                        key={orden.id_orden_compra}
                        value={orden.id_orden_compra}
                      >
                        {orden.numero_orden}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha *</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => updateField("fecha", e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {form.id_orden_compra ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    overflowX: "auto",
                  }}
                >
                  <strong style={{ color: "#374151" }}>
                    Productos de la orden
                  </strong>
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "0.85rem",
                      margin: "0.35rem 0",
                    }}
                  >
                    Ingresá la cantidad de cada producto para calcular el importe.
                    Elegí la alícuota que figura en cada renglón.
                  </p>
                  {loadingDetalle ? (
                    <p style={{ color: "#6b7280" }}>Cargando productos...</p>
                  ) : (
                    <table
                      style={{
                        width: "100%",
                        marginTop: "0.6rem",
                        borderCollapse: "collapse",
                        minWidth: "700px",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            textAlign: "left",
                            color: "#6b7280",
                            fontSize: "0.78rem",
                          }}
                        >
                          <th>Producto</th>
                          <th>Solicitada</th>
                          <th>Cantidad</th>
                          <th>Precio unitario</th>
                          <th>IVA</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detallesOrden.map((detalle, index) => (
                          <tr key={detalle.id_detalle_orden}>
                            <td style={{ padding: "0.5rem 0" }}>
                              {detalle.articulo?.nombre || "Artículo"}
                            </td>
                            <td>{detalle.cantidad_solicitada}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={detalle.cantidad}
                                onChange={(e) =>
                                  updateDetalle(index, "cantidad", e.target.value)
                                }
                                style={{ ...inputStyle, width: "115px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={detalle.precio_unitario}
                                onChange={(e) =>
                                  updateDetalle(
                                    index,
                                    "precio_unitario",
                                    e.target.value,
                                  )
                                }
                                style={{ ...inputStyle, width: "115px" }}
                              />
                            </td>
                            <td>
                              <select
                                value={detalle.tasa_iva}
                                onChange={(e) =>
                                  updateDetalle(index, "tasa_iva", e.target.value)
                                }
                                style={{ ...inputStyle, width: "100px" }}
                              >
                                {ALICUOTAS_IVA.map((tasa) => (
                                  <option key={tasa} value={tasa}>
                                    {tasa === 0 ? "Exento" : `${tasa}%`}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {currency(
                                Number(detalle.cantidad || 0) *
                                  Number(detalle.precio_unitario || 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    overflowX: "auto",
                  }}
                >
                  <strong style={{ color: "#374151" }}>Ítems de la factura</strong>
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "0.85rem",
                      margin: "0.35rem 0",
                    }}
                  >
                    Agregá servicios o gastos que no tienen orden de compra.
                  </p>
                  {detallesOrden.map((detalle, index) => (
                    <div
                      key={`manual-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                        gap: "0.75rem",
                        alignItems: "end",
                        marginTop: "0.75rem",
                      }}
                    >
                      <div>
                        <label style={labelStyle}>Descripción</label>
                        <input
                          value={detalle.descripcion}
                          onChange={(e) =>
                            updateDetalle(index, "descripcion", e.target.value)
                          }
                          style={inputStyle}
                          placeholder="Luz, gas, internet..."
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Cantidad</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={detalle.cantidad}
                          onChange={(e) =>
                            updateDetalle(index, "cantidad", e.target.value)
                          }
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Precio unitario</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={detalle.precio_unitario}
                          onChange={(e) =>
                            updateDetalle(index, "precio_unitario", e.target.value)
                          }
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>IVA</label>
                        <select
                          value={detalle.tasa_iva}
                          onChange={(e) =>
                            updateDetalle(index, "tasa_iva", e.target.value)
                          }
                          style={inputStyle}
                        >
                          {ALICUOTAS_IVA.map((tasa) => (
                            <option key={tasa} value={tasa}>
                              {tasa === 0 ? "Exento" : `${tasa}%`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarDetalle(index)}
                        style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarDetalleManual}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.6rem 1rem",
                      border: "1px solid #65482b",
                      background: "#fff",
                      color: "#65482b",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} /> Agregar ítem
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: "1rem",
                  alignItems: "end",
                }}
              >
                {[
                  "subtotal",
                  "iva",
                  "conceptos_exentos",
                  "percepcion_iva",
                  "percepcion_iibb",
                ].map((field) => (
                  <div key={field}>
                    <label style={labelStyle}>
                      {field === "conceptos_exentos"
                        ? "Exentos"
                        : field === "percepcion_iva"
                          ? "Percepción IVA"
                          : field === "percepcion_iibb"
                            ? "Percepción IIBB"
                            : field.toUpperCase()}{" "}
                      {field === "subtotal" || field === "iva" ? "*" : ""}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        field === "subtotal" && tieneDetalles
                          ? subtotalDetalle.toFixed(2)
                          : field === "iva" && tieneDetalles
                            ? ivaCalculado.toFixed(2)
                            : field === "conceptos_exentos" && tieneDetalles
                              ? exentosCalculado.toFixed(2)
                              : form[field]
                      }
                      onChange={(e) => updateField(field, e.target.value)}
                      style={inputStyle}
                      required={field === "subtotal" || field === "iva"}
                      readOnly={
                        tieneDetalles &&
                        (field === "subtotal" ||
                          field === "iva" ||
                          field === "conceptos_exentos")
                      }
                    />
                  </div>
                ))}
                <div
                  style={{
                    background: "#f7f3ef",
                    borderRadius: "0.5rem",
                    padding: "0.625rem 0.75rem",
                    minHeight: "42px",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ ...labelStyle, marginBottom: "0.15rem" }}>
                    Total
                  </span>
                  <strong style={{ color: "#65482b", fontSize: "1.1rem" }}>
                    {currency(tieneDetalles ? totalCalculado : total)}
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setModalRegistroAbierto(false)}
                  style={{
                    background: "#e5e7eb",
                    color: "#374151",
                    border: 0,
                    borderRadius: "0.5rem",
                    padding: "0.7rem 1.25rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "#65482b",
                    color: "#fff",
                    border: 0,
                    borderRadius: "0.5rem",
                    padding: "0.7rem 1.25rem",
                    fontWeight: "700",
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  {saving ? "Guardando..." : "Registrar factura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Factura */}
      {facturaDetalle && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "0.75rem",
              padding: "2rem",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>Detalle de factura</h2>
                <p style={{ color: "#6b7280", margin: "0.35rem 0 1rem" }}>
                  {facturaDetalle.tipo_comprobante}{" "}
                  {facturaDetalle.tipo_factura || ""} -{" "}
                  {formatNumeroComprobante(
                    facturaDetalle.punto_venta,
                    facturaDetalle.numero_comprobante,
                  )}{" "}
                  - {facturaDetalle.proveedor?.razon_social || "Sin proveedor"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFacturaDetalle(null)}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                <X size={24} />
              </button>
            </div>
            {loadingFacturaDetalle ? (
              <p>Cargando detalle...</p>
            ) : detalleFactura.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                Esta factura no tiene renglones detallados.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "0.6rem" }}>
                      Descripción
                    </th>
                    <th style={{ textAlign: "right", padding: "0.6rem" }}>
                      Cantidad
                    </th>
                    <th style={{ textAlign: "right", padding: "0.6rem" }}>
                      Precio unitario
                    </th>
                    <th style={{ textAlign: "right", padding: "0.6rem" }}>
                      IVA
                    </th>
                    <th style={{ textAlign: "right", padding: "0.6rem" }}>
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detalleFactura.map((detalle) => (
                    <tr
                      key={detalle.id_detalle_factura}
                      style={{ borderTop: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "0.6rem" }}>
                        {detalle.descripcion ||
                          detalle.articulo?.nombre ||
                          "Artículo"}
                      </td>
                      <td style={{ textAlign: "right", padding: "0.6rem" }}>
                        {detalle.cantidad}
                      </td>
                      <td style={{ textAlign: "right", padding: "0.6rem" }}>
                        {currency(detalle.precio_unitario)}
                      </td>
                      <td style={{ textAlign: "right", padding: "0.6rem" }}>
                        {detalle.tasa_iva}%
                      </td>
                      <td style={{ textAlign: "right", padding: "0.6rem" }}>
                        {currency(detalle.importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #e5e7eb",
                paddingTop: "1rem",
              }}
            >
              <strong style={{ fontSize: "1.1rem" }}>Total: {currency(facturaDetalle.importe_total)}</strong>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => downloadFacturaPdf(facturaDetalle, detalleFactura)}
                  style={{ border: 0, background: "#65482b", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1rem", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  Descargar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setFacturaDetalle(null)}
                  style={{ background: "#334155", color: "#fff", border: 0, borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: "600", cursor: "pointer" }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}