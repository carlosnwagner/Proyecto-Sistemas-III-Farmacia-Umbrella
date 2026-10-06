-- ==============================================================================
-- HU49: Seleccionar y abrir caja (Sprint 4)
-- ==============================================================================

BEGIN;

-- 1. Índices únicos de concurrencia (CA6)
-- Impide dos turnos abiertos simultáneamente para la misma caja
CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto_por_caja
ON public.turno_caja (caja_id)
WHERE estado = 'Abierto';

-- Impide que un cajero tenga abiertas más de una caja a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto_por_cajero
ON public.turno_caja (cajero_id)
WHERE estado = 'Abierto';

-- 2. Permisos para roles públicos y autenticados (sin RLS estricto en esta etapa)
GRANT SELECT, INSERT, UPDATE ON public.caja TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.turno_caja TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usuario_sucursal_caja TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usuario_auth_caja TO anon, authenticated;

-- Permisos sobre secuencias (para inserciones con identity/serial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3. Función RPC Transaccional: abrir_turno_caja (CA5, CA6, CA7)
CREATE OR REPLACE FUNCTION public.abrir_turno_caja(
  p_caja_id integer,
  p_sucursal_id integer,
  p_cajero_id integer,
  p_saldo_inicial numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario record;
  v_caja record;
  v_nuevo_turno record;
BEGIN
  -- CA3: Validación de importe inicial
  IF p_saldo_inicial IS NULL OR p_saldo_inicial < 0 THEN
    RAISE EXCEPTION 'El importe inicial es obligatorio y debe ser mayor o igual a cero';
  END IF;

  -- CA1: Validación de usuario y permisos
  SELECT id_usuario, rol, estado INTO v_usuario
  FROM public.usuario
  WHERE id_usuario = p_cajero_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario indicado no existe en el sistema';
  END IF;

  IF v_usuario.estado IS NOT TRUE THEN
    RAISE EXCEPTION 'El usuario se encuentra inactivo';
  END IF;

  IF v_usuario.rol <> 'cajero' THEN
    RAISE EXCEPTION 'El usuario no posee rol de cajero para abrir caja';
  END IF;

  -- Validación de caja y sucursal
  SELECT id, sucursal_id, activa, nombre INTO v_caja
  FROM public.caja
  WHERE id = p_caja_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La caja seleccionada no existe';
  END IF;

  IF v_caja.activa IS NOT TRUE THEN
    RAISE EXCEPTION 'La caja seleccionada se encuentra inactiva';
  END IF;

  IF v_caja.sucursal_id <> p_sucursal_id THEN
    RAISE EXCEPTION 'La caja no pertenece a la sucursal especificada';
  END IF;

  -- CA1: Validación de sucursal autorizada para el cajero
  -- Si existen registros en usuario_sucursal_caja, validamos pertenencia
  IF EXISTS (SELECT 1 FROM public.usuario_sucursal_caja WHERE usuario_id = p_cajero_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.usuario_sucursal_caja
      WHERE usuario_id = p_cajero_id AND sucursal_id = p_sucursal_id
    ) THEN
      RAISE EXCEPTION 'El cajero no está autorizado para operar en la sucursal indicada';
    END IF;
  END IF;

  -- CA6: Validación preventiva de turno previo del cajero
  IF EXISTS (
    SELECT 1 FROM public.turno_caja
    WHERE cajero_id = p_cajero_id AND estado = 'Abierto'
  ) THEN
    RAISE EXCEPTION 'El cajero ya tiene un turno abierto activo';
  END IF;

  -- CA6: Validación preventiva de caja ya ocupada
  IF EXISTS (
    SELECT 1 FROM public.turno_caja
    WHERE caja_id = p_caja_id AND estado = 'Abierto'
  ) THEN
    RAISE EXCEPTION 'La caja seleccionada ya se encuentra abierta por otro cajero';
  END IF;

  -- CA5, CA7: Inserción atómica del turno
  INSERT INTO public.turno_caja (
    caja_id,
    sucursal_id,
    cajero_id,
    saldo_inicial,
    estado,
    fecha_hora_apertura
  ) VALUES (
    p_caja_id,
    p_sucursal_id,
    p_cajero_id,
    p_saldo_inicial,
    'Abierto',
    now()
  )
  RETURNING id, caja_id, sucursal_id, cajero_id, saldo_inicial, estado, fecha_hora_apertura
  INTO v_nuevo_turno;

  RETURN jsonb_build_object(
    'id', v_nuevo_turno.id,
    'caja_id', v_nuevo_turno.caja_id,
    'caja_nombre', v_caja.nombre,
    'sucursal_id', v_nuevo_turno.sucursal_id,
    'cajero_id', v_nuevo_turno.cajero_id,
    'saldo_inicial', v_nuevo_turno.saldo_inicial,
    'estado', v_nuevo_turno.estado,
    'fecha_hora_apertura', v_nuevo_turno.fecha_hora_apertura
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'La caja ya fue abierta por otro cajero o el usuario ya tiene un turno activo';
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_turno_caja TO anon, authenticated;

-- 4. Datos iniciales (Seed Data) para desarrollo y pruebas
-- Insertar cajas si no existen en la sucursal 5 (Sucursal Central) y 8
INSERT INTO public.caja (sucursal_id, nombre, activa)
SELECT 5, 'Caja 01 - Mostrador Principal', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.caja WHERE sucursal_id = 5 AND nombre = 'Caja 01 - Mostrador Principal'
);

INSERT INTO public.caja (sucursal_id, nombre, activa)
SELECT 5, 'Caja 02 - Farmacia y Recetas', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.caja WHERE sucursal_id = 5 AND nombre = 'Caja 02 - Farmacia y Recetas'
);

INSERT INTO public.caja (sucursal_id, nombre, activa)
SELECT 8, 'Caja 01 - Atención al Público', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.caja WHERE sucursal_id = 8 AND nombre = 'Caja 01 - Atención al Público'
);

-- Vincular al cajero Gunner912 (id_usuario = 14) con la Sucursal 5 en usuario_sucursal_caja
INSERT INTO public.usuario_sucursal_caja (usuario_id, sucursal_id)
SELECT 14, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuario_sucursal_caja WHERE usuario_id = 14 AND sucursal_id = 5
);

COMMIT;
