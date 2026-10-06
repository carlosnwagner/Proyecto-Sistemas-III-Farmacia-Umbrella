import { useState, useMemo } from 'react';
import { Calculator, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { showAlert } from '../lib/alerts.js';
import { registrarArqueoBackend } from '../services/caja.js';

export default function ArqueoCajaModal({ isOpen, onClose, ventasTurno }) {
  const [efectivoContado, setEfectivoContado] = useState('');
  const [cargando, setCargando] = useState(false);

  // MOCK: Esto debería venir de la BD (Fondo fijo + ventas en efectivo del turno actual)
  const efectivoEsperado = 10000 + Number(ventasTurno || 0); 

  // Cálculos dinámicos (Criterio: Calcula diferencia = contado - esperado)[cite: 13]
  const diferencia = useMemo(() => {
    const contado = Number(efectivoContado);
    if (isNaN(contado) || efectivoContado === '') return 0;
    return contado - efectivoEsperado;
  }, [efectivoContado, efectivoEsperado]);

  // Identificación del estado (Criterio: Identifica faltante, sobrante o sin diferencia)[cite: 13]
  const estadoArqueo = useMemo(() => {
    if (diferencia < 0) return { texto: 'FALTANTE', color: '#dc2626', bg: '#fef2f2' };
    if (diferencia > 0) return { texto: 'SOBRANTE', color: '#d97706', bg: '#fffbeb' };
    return { texto: 'CAJA CUADRADA', color: '#166534', bg: '#f0fdf4' };
  }, [diferencia]);

  if (!isOpen) return null;

  const handleGuardarArqueo = async (e) => {
    e.preventDefault();
    
    // Criterio: Exige importe contado numérico mayor o igual a cero[cite: 13]
    const contadoFinal = Number(efectivoContado);
    if (isNaN(contadoFinal) || contadoFinal < 0 || efectivoContado === '') {
      return showAlert.errorSave('Debe ingresar un importe contado válido mayor o igual a cero.');
    }

    setCargando(true);

    try {
      const payload = {
        turno_id: 1,     // TODO: Reemplazar por el ID del turno abierto real cuando esté el módulo de turnos
        usuario_id: 1,   // TODO: Reemplazar por el ID del usuario logueado
        efectivo_esperado: efectivoEsperado,
        efectivo_contado: contadoFinal,
        diferencia: diferencia
      };

      const { error } = await registrarArqueoBackend(payload);
      
      if (error) throw error;

      // Usamos las alertas estandarizadas de tu compañera
      showAlert.successAction('Arqueo de caja', false);
      
      setEfectivoContado('');
      onClose();
      
    } catch (error) {
      showAlert.errorSave('Error al guardar el arqueo: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "0.75rem", borderRadius: "0.375rem", 
    border: "1px solid #d1d5db", fontSize: "1.1rem", outline: "none", 
    textAlign: "right", fontWeight: "600", boxSizing: "border-box"
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calculator size={20} /> Cierre y Arqueo de Caja
          </h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleGuardarArqueo} style={{ padding: '1.5rem' }}>
          
          {/* Criterio: Muestra la caja, el turno y el efectivo esperado antes de guardar[cite: 13] */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#4b5563', backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div><b>Caja:</b> Principal - Sucursal Centro</div>
            <div><b>Turno:</b> Mañana (Abierto)</div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem' }}>Efectivo Esperado en Sistema</label>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              ${efectivoEsperado.toFixed(2)}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Efectivo Físico Contado *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '600', color: '#6b7280' }}>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                style={inputStyle}
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Resultado de la diferencia */}
          {efectivoContado !== '' && (
            <div style={{ backgroundColor: estadoArqueo.bg, border: `1px solid ${estadoArqueo.color}`, padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: estadoArqueo.color, fontWeight: '700' }}>
                {diferencia === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {estadoArqueo.texto}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: estadoArqueo.color }}>
                ${Math.abs(diferencia).toFixed(2)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button type="button" onClick={onClose} style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', padding: '0.625rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>
              Cancelar
            </button>
            <button type="submit" disabled={cargando} style={{ backgroundColor: '#111827', color: '#fff', border: 0, padding: '0.625rem 1.5rem', borderRadius: '0.375rem', fontWeight: '700', cursor: cargando ? 'not-allowed' : 'pointer' }}>
              {cargando ? 'Guardando...' : 'Confirmar Arqueo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}