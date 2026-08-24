import React, { useState } from 'react';
import RegistrarPagoProveedor from './components/RegistrarPagoProveedor';
import RegistrarNotaCreditoDebito from './components/RegistrarNotaCreditoDebito';
import './App.css';

export default function App() {
  const [pantalla, setPantalla] = useState('pagos');

  return (
    <div className="pagos-pagina">
      {/* Menú de navegación entre las 2 HU */}
      <div style={{marginBottom:'1.5rem', display:'flex', gap:'1rem'}}>
        <button 
          onClick={() => setPantalla('pagos')}
          style={{
            padding:'0.6rem 1.2rem', 
            background: pantalla==='pagos' ? 'var(--verde-oscuro)' : 'transparent', 
            color: pantalla==='pagos' ? 'white' : 'var(--marron-oscuro)', 
            border:'none', borderRadius:'var(--redondeo)', cursor:'pointer',
            fontWeight:'500'
          }}
        >
          HU33 — Pagos a Proveedores
        </button>
        <button 
          onClick={() => setPantalla('notas')}
          style={{
            padding:'0.6rem 1.2rem', 
            background: pantalla==='notas' ? 'var(--verde-oscuro)' : 'transparent', 
            color: pantalla==='notas' ? 'white' : 'var(--marron-oscuro)', 
            border:'none', borderRadius:'var(--redondeo)', cursor:'pointer',
            fontWeight:'500'
          }}
        >
          HU31 — Notas de Crédito/Débito
        </button>
      </div>

      {pantalla === 'pagos' && <RegistrarPagoProveedor />}
      {pantalla === 'notas' && <RegistrarNotaCreditoDebito />}
    </div>
  );
}