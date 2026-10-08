import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { consultarTurnos, consultarDetalleTurno } from '../services/cajaTurnos.js';

export default function useCajaTurnos() {
  const [revision, setRevision] = useState(0);
  const [lista, setLista] = useState({ autenticado: false, turnos: [] });
  const [turnoId, setTurnoId] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const actualizar = () => setRevision(n => n + 1);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setRevision(n => n + 1));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const datos = await consultarTurnos();
        if (!activo) return;
        setLista(datos);
        setTurnoId(id => datos.turnos.some(t => String(t.id) === id) ? id : String(datos.turnos[0]?.id || ''));
      } catch (e) {
        if (activo) { setError(e.message); setLista({ autenticado: false, turnos: [] }); setTurnoId(''); }
      } finally { if (activo) setCargando(false); }
    }
    cargar();
    return () => { activo = false; };
  }, [revision]);
  useEffect(() => {
    let activo = true;
    async function cargar() {
      setDetalle(null);
      setCargandoDetalle(false);
      if (!lista.autenticado || !turnoId || cargando) return;
      setCargandoDetalle(true);
      try {
        const datos = await consultarDetalleTurno(turnoId);
        if (activo) setDetalle(datos);
      } catch (e) { if (activo) setError(e.message); }
      finally { if (activo) setCargandoDetalle(false); }
    }
    cargar();
    return () => { activo = false; };
  }, [turnoId, lista.autenticado, revision, cargando]);
  const turno = lista.turnos.find(t => String(t.id) === turnoId);
  return { ...lista, turnoId, setTurnoId, turno,
    detalle: !cargando && !cargandoDetalle && String(detalle?.turno.id) === turnoId ? detalle : null,
    error, cargando: cargando || cargandoDetalle, actualizar };
}
