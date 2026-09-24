import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Users, X } from 'lucide-react';
import { actualizarCliente, getClientes } from '../services/ventas.js';
import { showAlert } from '../lib/alerts.js';

const FORM_INICIAL = {
  nombre: '',
  dni: '',
  cuit: '',
  telefono: '',
  condicion_fiscal: 'Consumidor Final',
  aplica_percepcion_iva: false,
  aplica_percepcion_iibb: false,
  estado: true
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.4rem',
  fontSize: '0.875rem',
  backgroundColor: '#fff'
};

export default function ClientesVentas() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [cargando, setCargando] = useState(true);

  const cargarClientes = async () => {
    setCargando(true);
    const { data, error } = await getClientes();
    setCargando(false);
    if (error) return showAlert.errorSave(`No se pudieron cargar los clientes: ${error.message}`);
    setClientes(data);
  };

  useEffect(() => {
    let vigente = true;
    getClientes().then(({ data, error }) => {
      if (!vigente) return;
      setCargando(false);
      if (error) {
        showAlert.errorSave(`No se pudieron cargar los clientes: ${error.message}`);
        return;
      }
      setClientes(data);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return clientes.filter((cliente) => {
      const coincideBusqueda = !termino || [cliente.nombre, cliente.dni, cliente.cuit, cliente.telefono]
        .some((valor) => String(valor || '').toLowerCase().includes(termino));
      const activo = cliente.estado === true;
      const coincideEstado = filtroEstado === 'todos'
        || (filtroEstado === 'activos' && activo)
        || (filtroEstado === 'inactivos' && !activo);
      return coincideBusqueda && coincideEstado;
    });
  }, [clientes, busqueda, filtroEstado]);

  const abrirEdicion = (cliente) => {
    setEditando(cliente);
    setForm({
      nombre: cliente.nombre || '',
      dni: cliente.dni || '',
      cuit: cliente.cuit || '',
      telefono: cliente.telefono || '',
      condicion_fiscal: cliente.condicion_fiscal || 'Consumidor Final',
      aplica_percepcion_iva: Boolean(cliente.aplica_percepcion_iva),
      aplica_percepcion_iibb: Boolean(cliente.aplica_percepcion_iibb),
      estado: cliente.estado === true
    });
  };

  const cambiarCondicion = (condicion_fiscal) => {
    setForm((actual) => ({
      ...actual,
      condicion_fiscal,
      aplica_percepcion_iva: condicion_fiscal === 'Responsable Inscripto' ? actual.aplica_percepcion_iva : false,
      aplica_percepcion_iibb: condicion_fiscal === 'Responsable Inscripto' ? actual.aplica_percepcion_iibb : false
    }));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return showAlert.errorSave('El nombre o razón social es obligatorio.');
    if (/\d/.test(nombre)) return showAlert.errorSave('El nombre o razón social no puede contener números.');
    if (form.dni && !/^\d{7,8}$/.test(form.dni)) return showAlert.errorSave('El DNI debe tener 7 u 8 dígitos.');
    if (form.cuit && !/^\d{11}$/.test(form.cuit)) return showAlert.errorSave('El CUIT debe tener 11 dígitos.');

    setCargando(true);
    const { error } = await actualizarCliente(editando.id_cliente, {
      nombre,
      dni: form.dni || null,
      cuit: form.cuit || null,
      telefono: form.telefono.trim() || null,
      condicion_fiscal: form.condicion_fiscal,
      aplica_percepcion_iva: form.aplica_percepcion_iva,
      aplica_percepcion_iibb: form.aplica_percepcion_iibb,
      estado: form.estado
    });
    setCargando(false);
    if (error) return showAlert.errorSave(`No se pudo actualizar el cliente: ${error.message}`);

    setEditando(null);
    await cargarClientes();
    showAlert.successSave('Cliente actualizado correctamente.');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.9rem', margin: 0, color: '#111827' }}>Clientes</h1>
        <p style={{ color: '#6b7280', margin: '0.3rem 0 0' }}>Consulta y edición de clientes utilizados en ventas.</p>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI, CUIT o teléfono..."
            style={{ ...inputStyle, paddingLeft: '2.35rem' }}
          />
        </div>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="todos">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.65rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
          <thead style={{ backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '0.75rem' }}>
            <tr>
              {['CLIENTE', 'DNI / CUIT', 'TELÉFONO', 'CONDICIÓN FISCAL', 'PERCEPCIONES', 'ESTADO', 'ACCIÓN'].map((titulo) => (
                <th key={titulo} style={{ padding: '0.85rem 1rem', textAlign: titulo === 'ACCIÓN' ? 'center' : 'left' }}>{titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!cargando && clientesFiltrados.length === 0 && (
              <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}><Users size={32} /><br />No se encontraron clientes.</td></tr>
            )}
            {cargando && <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando clientes...</td></tr>}
            {!cargando && clientesFiltrados.map((cliente) => {
              const percepciones = [];
              if (cliente.aplica_percepcion_iva) percepciones.push('IVA 1%');
              if (cliente.aplica_percepcion_iibb) percepciones.push('IIBB 3,6%');
              return (
                <tr key={cliente.id_cliente} style={{ borderTop: '1px solid #f3f4f6', fontSize: '0.86rem' }}>
                  <td style={{ padding: '0.9rem 1rem', fontWeight: 650 }}>{cliente.nombre}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>{cliente.cuit || cliente.dni || 'Sin identificar'}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>{cliente.telefono || '-'}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>{cliente.condicion_fiscal}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>{percepciones.join(' + ') || 'No aplica'}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, backgroundColor: cliente.estado ? '#dcfce7' : '#fee2e2', color: cliente.estado ? '#166534' : '#991b1b' }}>
                      {cliente.estado ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                    <button type="button" onClick={() => abrirEdicion(cliente)} title="Editar cliente" style={{ padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.4rem', backgroundColor: '#fff', color: '#65482b', cursor: 'pointer' }}><Pencil size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={guardar} style={{ width: 'min(650px, 96vw)', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '0.7rem', boxShadow: '0 20px 30px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.4rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Editar cliente</h2>
              <button type="button" onClick={() => setEditando(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><X size={21} /></button>
            </div>
            <div style={{ padding: '1.4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nombre / Razón social *<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Teléfono<input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>DNI<input maxLength="8" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>CUIT<input maxLength="11" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Condición fiscal
                <select value={form.condicion_fiscal} onChange={(e) => cambiarCondicion(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }}>
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                  <option value="Exento">Exento</option>
                </select>
              </label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Estado
                <select value={String(form.estado)} onChange={(e) => setForm({ ...form, estado: e.target.value === 'true' })} style={{ ...inputStyle, marginTop: '0.3rem' }}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
              {form.condicion_fiscal === 'Responsable Inscripto' && (
                <div style={{ gridColumn: '1 / -1', padding: '0.85rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.4rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.55rem' }}>Percepciones aplicables sobre el neto gravado</div>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.84rem', marginBottom: '0.45rem' }}><input type="checkbox" checked={form.aplica_percepcion_iva} onChange={(e) => setForm({ ...form, aplica_percepcion_iva: e.target.checked })} /> IVA 1%</label>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.84rem' }}><input type="checkbox" checked={form.aplica_percepcion_iibb} onChange={(e) => setForm({ ...form, aplica_percepcion_iibb: e.target.checked })} /> IIBB 3,6%</label>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', padding: '1rem 1.4rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <button type="button" onClick={() => setEditando(null)} style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.4rem', backgroundColor: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={cargando} style={{ padding: '0.55rem 1rem', border: 0, borderRadius: '0.4rem', backgroundColor: '#65482b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
