import React from 'react';

export default function TiendaBeneficios() {
  const beneficios = [
    {
      icono: 'fa-truck',
      titulo: 'Envío rápido y seguro',
      descripcion: 'Entregas a domicilio o retiro gratis en sucursal'
    },
    {
      icono: 'fa-shield',
      titulo: 'Garantía de Farmacia',
      descripcion: 'Medicamentos y productos 100% originales'
    },
    {
      icono: 'fa-credit-card',
      titulo: 'Pagos Seguros',
      descripcion: 'Tarjetas de crédito, débito y transferencias'
    },
    {
      icono: 'fa-user-md',
      titulo: 'Atención Farmacéutica',
      descripcion: 'Soporte y asesoramiento para tus pedidos'
    }
  ];

  return (
    <section style={{ 
      backgroundColor: '#ffffff', 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px', 
      padding: '25px 20px', 
      marginTop: '25px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
    }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '20px',
        alignItems: 'center'
      }}>
        {beneficios.map((b, index) => (
          <div 
            key={index} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '15px',
              padding: '10px'
            }}
          >
            {/* Icono circular con color institucional #555934 */}
            <div style={{ 
              width: '50px', 
              height: '50px', 
              backgroundColor: '#f4f5f2', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#555934',
              fontSize: '20px',
              flexShrink: 0
            }}>
              <i className={`fa ${b.icono}`}></i>
            </div>

            {/* Textos Informativos */}
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                {b.titulo}
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                {b.descripcion}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}