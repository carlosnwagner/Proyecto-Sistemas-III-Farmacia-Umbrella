import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Landmark,
  Search,
  Wallet,
} from "lucide-react";

const turnosCaja = [
  {
    id: 1,
    codigoTurno: "T-1024",
    caja: "Caja 1",
    sucursal: "Sede Centro",
    cajero: "María López",
    estado: "Cerrado",
    fechaApertura: "2026-10-06T08:30:00",
    fechaCierre: "2026-10-06T12:10:00",
    saldoInicial: 15000,
    ingresosEfectivo: 24500,
    egresosEfectivo: 3800,
    ingresosTarjeta: 11800,
    egresosTarjeta: 0,
    ingresosTransferencia: 5600,
    egresosTransferencia: 1200,
    efectivoEsperado: 15700,
    efectivoReal: 15950,
    totalCierre: 16850,
    movimientos: [
      { id: 101, fecha: "2026-10-06T08:45:00", tipo: "Ingreso", concepto: "Apertura de caja", importe: 15000, medio: "Efectivo", origen: "Manual", usuario: "María López", referencia: "Saldo inicial", esRevision: false },
      { id: 102, fecha: "2026-10-06T09:10:00", tipo: "Ingreso", concepto: "Cobro de venta", importe: 5200, medio: "Efectivo", origen: "Venta", usuario: "María López", referencia: "VT-00128", esRevision: false },
      { id: 103, fecha: "2026-10-06T09:18:00", tipo: "Ingreso", concepto: "Cobro tarjeta", importe: 4500, medio: "Tarjeta", origen: "Venta", usuario: "María López", referencia: "VT-00129", esRevision: false },
      { id: 104, fecha: "2026-10-06T10:05:00", tipo: "Egreso", concepto: "Cambio de caja", importe: 1800, medio: "Efectivo", origen: "Manual", usuario: "María López", referencia: "Cambio de billetes", esRevision: false },
      { id: 105, fecha: "2026-10-06T10:12:00", tipo: "Ingreso", concepto: "Cobro transferencia", importe: 5600, medio: "Transferencia", origen: "Venta", usuario: "María López", referencia: "VT-00131", esRevision: false },
      { id: 106, fecha: "2026-10-06T11:00:00", tipo: "Egreso", concepto: "Reverso de cobro", importe: -5200, medio: "Efectivo", origen: "Venta", usuario: "María López", referencia: "VT-00128", esRevision: true },
      { id: 107, fecha: "2026-10-06T11:02:00", tipo: "Ingreso", concepto: "Cobro de venta compensado", importe: 5200, medio: "Efectivo", origen: "Venta", usuario: "María López", referencia: "VT-00128-A", esRevision: false },
      { id: 108, fecha: "2026-10-06T11:35:00", tipo: "Egreso", concepto: "Pago de caja chica", importe: 2000, medio: "Efectivo", origen: "Manual", usuario: "María López", referencia: "Gasto operativo", esRevision: false },
    ],
  },
  {
    id: 2,
    codigoTurno: "T-1025",
    caja: "Caja 2",
    sucursal: "Sucursal Norte",
    cajero: "Carlos Ruiz",
    estado: "Abierto",
    fechaApertura: "2026-10-06T13:00:00",
    fechaCierre: null,
    saldoInicial: 12000,
    ingresosEfectivo: 9800,
    egresosEfectivo: 1200,
    ingresosTarjeta: 7600,
    egresosTarjeta: 0,
    ingresosTransferencia: 2400,
    egresosTransferencia: 0,
    efectivoEsperado: 10600,
    efectivoReal: 10850,
    totalCierre: null,
    movimientos: [
      { id: 201, fecha: "2026-10-06T13:05:00", tipo: "Ingreso", concepto: "Saldo inicial", importe: 12000, medio: "Efectivo", origen: "Manual", usuario: "Carlos Ruiz", referencia: "Apertura", esRevision: false },
      { id: 202, fecha: "2026-10-06T13:40:00", tipo: "Ingreso", concepto: "Cobro de venta", importe: 3600, medio: "Efectivo", origen: "Venta", usuario: "Carlos Ruiz", referencia: "VT-00314", esRevision: false },
      { id: 203, fecha: "2026-10-06T14:05:00", tipo: "Egreso", concepto: "Retiro para caja chica", importe: 1200, medio: "Efectivo", origen: "Manual", usuario: "Carlos Ruiz", referencia: "Retiro autorizado", esRevision: false },
      { id: 204, fecha: "2026-10-06T14:30:00", tipo: "Ingreso", concepto: "Cobro tarjeta", importe: 7600, medio: "Tarjeta", origen: "Venta", usuario: "Carlos Ruiz", referencia: "VT-00318", esRevision: false },
      { id: 205, fecha: "2026-10-06T15:10:00", tipo: "Ingreso", concepto: "Cobro transferencia", importe: 2400, medio: "Transferencia", origen: "Venta", usuario: "Carlos Ruiz", referencia: "VT-00325", esRevision: false },
    ],
  },
];

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(valor || 0));

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
};

function SummaryCard({ title, value, accent, icon: Icon, hint }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "1rem 1.1rem",
        boxShadow: "0 8px 22px rgba(17, 24, 39, 0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{title}</span>
        <div style={{ background: accent, borderRadius: 10, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color="#111827" />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export default function TurnosCaja() {
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState("Todas");
  const [cajaSeleccionada, setCajaSeleccionada] = useState("Todas");
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Todos");
  const [medioSeleccionado, setMedioSeleccionado] = useState("Todos");
  const [turnoActivoId, setTurnoActivoId] = useState(turnosCaja[0].id);

  const sucursales = ["Todas", ...new Set(turnosCaja.map((turno) => turno.sucursal))];
  const cajas = ["Todas", ...new Set(turnosCaja.map((turno) => turno.caja))];

  const turnosFiltrados = useMemo(() => {
    return turnosCaja.filter((turno) => {
      const coincideSucursal = sucursalSeleccionada === "Todas" || turno.sucursal === sucursalSeleccionada;
      const coincideCaja = cajaSeleccionada === "Todas" || turno.caja === cajaSeleccionada;
      return coincideSucursal && coincideCaja;
    });
  }, [sucursalSeleccionada, cajaSeleccionada]);

  const turnoActivo =
    turnosFiltrados.find((turno) => turno.id === turnoActivoId) || turnosFiltrados[0] || null;

  const movimientosFiltrados = useMemo(() => {
    if (!turnoActivo) return [];

    return turnoActivo.movimientos.filter((movimiento) => {
      const coincideTipo = tipoSeleccionado === "Todos" || movimiento.tipo === tipoSeleccionado;
      const coincideMedio = medioSeleccionado === "Todos" || movimiento.medio === medioSeleccionado;
      return coincideTipo && coincideMedio;
    });
  }, [turnoActivo, tipoSeleccionado, medioSeleccionado]);

  const numeroMovimientos = movimientosFiltrados.length;
  const ingresosEfectivo = turnoActivo?.movimientos.filter((m) => m.tipo === "Ingreso" && m.medio === "Efectivo").reduce((acc, item) => acc + Math.abs(Number(item.importe || 0)), 0) || 0;
  const egresosEfectivo = turnoActivo?.movimientos.filter((m) => m.tipo === "Egreso" && m.medio === "Efectivo").reduce((acc, item) => acc + Math.abs(Number(item.importe || 0)), 0) || 0;
  const efectivoEsperado = (turnoActivo?.saldoInicial || 0) + ingresosEfectivo - egresosEfectivo;

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Operaciones de caja</div>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: 34, color: "#111827" }}>Saldo y movimientos por turno</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ecfdf5", color: "#166534", borderRadius: 12, padding: "0.6rem 0.9rem", border: "1px solid #bbf7d0", fontWeight: 700 }}>
          <Wallet size={18} />
          {turnoActivo ? `${turnoActivo.caja} · ${turnoActivo.sucursal}` : "Sin turnos"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 22 }}>
        <SummaryCard title="Saldo inicial" value={formatearMoneda(turnoActivo?.saldoInicial || 0)} accent="#dcfce7" icon={Banknote} hint="Efectivo base al abrir la caja" />
        <SummaryCard title="Ingresos en efectivo" value={formatearMoneda(ingresosEfectivo)} accent="#dbeafe" icon={ArrowUpCircle} hint="Ventas y movimientos manuales" />
        <SummaryCard title="Egresos en efectivo" value={formatearMoneda(egresosEfectivo)} accent="#fee2e2" icon={ArrowDownCircle} hint="Retiros y gastos del turno" />
        <SummaryCard title="Efectivo esperado" value={formatearMoneda(efectivoEsperado)} accent="#fef3c7" icon={Landmark} hint="Saldo inicial + ingresos - egresos" />
      </div>

      <div style={{ background: "#ffffff", borderRadius: 18, border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 8px 22px rgba(17, 24, 39, 0.03)", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Search size={18} color="#6b7280" />
          <strong style={{ color: "#111827" }}>Filtros</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Sucursal</span>
            <select value={sucursalSeleccionada} onChange={(event) => setSucursalSeleccionada(event.target.value)} style={inputStyle}>
              {sucursales.map((sucursal) => (
                <option key={sucursal} value={sucursal}>{sucursal}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Caja</span>
            <select value={cajaSeleccionada} onChange={(event) => setCajaSeleccionada(event.target.value)} style={inputStyle}>
              {cajas.map((caja) => (
                <option key={caja} value={caja}>{caja}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Tipo</span>
            <select value={tipoSeleccionado} onChange={(event) => setTipoSeleccionado(event.target.value)} style={inputStyle}>
              <option value="Todos">Todos</option>
              <option value="Ingreso">Ingresos</option>
              <option value="Egreso">Egresos</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Medio de pago</span>
            <select value={medioSeleccionado} onChange={(event) => setMedioSeleccionado(event.target.value)} style={inputStyle}>
              <option value="Todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </label>
        </div>
      </div>

      {turnoActivo ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 0.7fr", gap: 22, marginBottom: 22 }}>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, boxShadow: "0 8px 22px rgba(17, 24, 39, 0.03)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#6b7280", fontWeight: 700, marginBottom: 12 }}>Turnos</div>
              <div style={{ display: "grid", gap: 10 }}>
                {turnosFiltrados.map((turno) => (
                  <button
                    key={turno.id}
                    onClick={() => setTurnoActivoId(turno.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: turno.id === turnoActivo.id ? "1px solid #86efac" : "1px solid #e5e7eb",
                      background: turno.id === turnoActivo.id ? "#f0fdf4" : "#ffffff",
                      color: "#111827",
                      borderRadius: 12,
                      padding: "0.75rem 0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}> 
                      <strong>{turno.codigoTurno}</strong>
                      <span style={{ fontSize: 11, color: turno.estado === "Cerrado" ? "#166534" : "#92400e", fontWeight: 800 }}>{turno.estado}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{turno.caja} · {turno.sucursal}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{formatearFecha(turno.fechaApertura)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, boxShadow: "0 8px 22px rgba(17, 24, 39, 0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#6b7280", fontWeight: 700 }}>Turno activo</div>
                  <h2 style={{ margin: "0.4rem 0 0", fontSize: 28, color: "#111827" }}>{turnoActivo.codigoTurno}</h2>
                </div>
                <span
                  style={{
                    background: turnoActivo.estado === "Cerrado" ? "#dcfce7" : "#fef3c7",
                    color: turnoActivo.estado === "Cerrado" ? "#166534" : "#92400e",
                    borderRadius: 999,
                    padding: "0.5rem 0.8rem",
                    fontWeight: 800,
                  }}
                >
                  {turnoActivo.estado}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <InfoChip label="Caja" value={turnoActivo.caja} />
                <InfoChip label="Sucursal" value={turnoActivo.sucursal} />
                <InfoChip label="Cajero" value={turnoActivo.cajero} />
                <InfoChip label="Apertura" value={formatearFecha(turnoActivo.fechaApertura)} />
                <InfoChip label="Cierre" value={formatearFecha(turnoActivo.fechaCierre)} />
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, boxShadow: "0 8px 22px rgba(17, 24, 39, 0.03)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#6b7280", fontWeight: 700, marginBottom: 12 }}>Totales por medio</div>
              <MetricRow label="Efectivo" value={formatearMoneda(turnoActivo.efectivoReal || efectivoEsperado)} />
              <MetricRow label="Tarjeta" value={formatearMoneda(turnoActivo.ingresosTarjeta || 0)} />
              <MetricRow label="Transferencia" value={formatearMoneda(turnoActivo.ingresosTransferencia || 0)} />
              <MetricRow label="Total cierre" value={formatearMoneda(turnoActivo.totalCierre || 0)} strong />
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 18, boxShadow: "0 8px 22px rgba(17, 24, 39, 0.03)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 18, borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#6b7280", fontWeight: 700 }}>Movimientos</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#111827" }}>{numeroMovimientos}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Badge label="Efectivo esperado" value={formatearMoneda(efectivoEsperado)} />
                <Badge label="Efectivo real" value={formatearMoneda(turnoActivo.efectivoReal || 0)} />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th style={thStyle}>Fecha y hora</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Concepto</th>
                    <th style={thStyle}>Importe</th>
                    <th style={thStyle}>Medio</th>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.length > 0 ? (
                    movimientosFiltrados.map((movimiento) => (
                      <tr key={movimiento.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={tdStyle}>{formatearFecha(movimiento.fecha)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background: movimiento.tipo === "Ingreso" ? "#dcfce7" : "#fee2e2",
                              color: movimiento.tipo === "Ingreso" ? "#166534" : "#991b1b",
                              borderRadius: 999,
                              padding: "0.38rem 0.6rem",
                              fontWeight: 700,
                            }}
                          >
                            {movimiento.tipo === "Ingreso" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                            {movimiento.tipo}
                          </span>
                          {movimiento.esRevision && (
                            <div style={{ fontSize: 11, color: "#b45309", marginTop: 4, fontWeight: 700 }}>Reversión</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700 }}>{movimiento.concepto}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{movimiento.referencia}</div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: Number(movimiento.importe) >= 0 ? "#111827" : "#b91c1c" }}>
                          {movimiento.esRevision ? "-" : ""}{formatearMoneda(Math.abs(Number(movimiento.importe || 0)))}
                        </td>
                        <td style={tdStyle}>{movimiento.medio}</td>
                        <td style={tdStyle}>{movimiento.usuario}</td>
                        <td style={tdStyle}>
                          <span style={{ color: movimiento.origen === "Venta" ? "#1d4ed8" : "#6b7280", fontWeight: 600 }}>{movimiento.origen}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                        No hay movimientos para el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 18, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
          No existen turnos para los filtros seleccionados.
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.75rem 0.9rem" }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700, color: "#111827" }}>{value || "-"}</div>
    </div>
  );
}

function MetricRow({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.7rem 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#111827", fontWeight: strong ? 800 : 700 }}>{value}</span>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eef2ff", color: "#3730a3", borderRadius: 999, padding: "0.45rem 0.7rem", fontWeight: 700, fontSize: 12 }}>
      {label}
      <span style={{ color: "#111827" }}>{value}</span>
    </span>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 10,
  padding: "0.7rem 0.8rem",
  fontSize: 14,
  outline: "none",
};

const thStyle = {
  padding: "0.85rem 1rem",
  textAlign: "left",
  fontSize: 12,
  color: "#374151",
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "0.9rem 1rem",
  color: "#111827",
  fontSize: 14,
  verticalAlign: "top",
};
