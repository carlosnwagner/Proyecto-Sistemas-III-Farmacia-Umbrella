import { useState } from 'react';
import { Calculator } from 'lucide-react';
import ArqueoCajaModal from '../components/ArqueoCajaModal.jsx';
import './MovimientosCaja.css';

export default function ArqueoCaja() {
  const [abierto, setAbierto] = useState(false);
  return <section className="caja-page">
    <header className="caja-header">
      <div><span className="caja-eyebrow">GESTIÓN DE CAJA</span>
        <h1>Arqueo de caja</h1>
        <p>Compará el efectivo contado con el esperado y revisá la diferencia.</p>
      </div>
    </header>
    <div className="caja-panel caja-form">
      <div className="caja-section-title"><h2>Recuento de efectivo</h2><Calculator size={24} /></div>
      <p>La integración del arqueo con el turno y el saldo real está pendiente. El formulario actual utiliza valores de ejemplo y puede intentar guardarlos en Supabase.</p>
      <button className="caja-button" style={{ marginTop: 20 }} onClick={() => setAbierto(true)}>Abrir formulario de arqueo</button>
    </div>
    <ArqueoCajaModal isOpen={abierto} onClose={() => setAbierto(false)} ventasTurno={0} />
  </section>;
}
