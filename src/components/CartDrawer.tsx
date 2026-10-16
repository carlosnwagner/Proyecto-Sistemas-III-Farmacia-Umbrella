import React, { useState } from 'react';
import { useCart } from '../hooks/useCart';
import { Trash2, X, ShoppingBag, AlertCircle } from 'lucide-react';
import { ConfirmarPedidoModal } from './ConfirmarPedidoModal';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sucursalNombre?: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, sucursalNombre }) => {
  const { items, updateQuantity, removeFromCart, getSubtotal, sucursalId } = useCart();
  const [modalConfirmarOpen, setModalConfirmarOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(2px)" }}>
        <div style={{ width: "100%", maxWidth: "420px", backgroundColor: "#ffffff", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-4px 0 25px rgba(0,0,0,0.15)" }}>
          
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ShoppingBag size={22} color="#15803d" />
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#111827", margin: 0 }}>Mi Bolsa</h2>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "4px" }}>
              <X size={22} />
            </button>
          </div>

          <div style={{ margin: "16px 24px 0 24px", padding: "12px 16px", backgroundColor: "#fef3c7", borderLeft: "4px solid #f59e0b", borderRadius: "4px", fontSize: "13px", color: "#92400e", display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <AlertCircle size={16} style={{ marginTop: "2px", flexShrink: 0 }} />
            <span>Agregar productos al carrito no reserva ni descuenta stock hasta confirmar el pedido.</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
                <ShoppingBag size={48} style={{ margin: "0 auto 16px auto", opacity: 0.3 }} />
                <p style={{ fontSize: "16px", fontWeight: "500" }}>Tu carrito está vacío</p>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>Explorá el catálogo y sumá productos.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {items.map((item) => (
                  <div key={item.id_articulo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingBottom: "16px", borderBottom: "1px solid #f3f4f6" }}>
                    
                    <div style={{ width: "50px", height: "50px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {item.imagen_url ? (
                        <img src={item.imagen_url} alt={item.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <ShoppingBag size={20} color="#9ca3af" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#1f2937", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</h4>
                      <p style={{ fontSize: "13px", color: "#059669", fontWeight: "600", margin: 0 }}>${item.precio_venta} c/u</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: "6px", overflow: "hidden", backgroundColor: "#f9fafb" }}>
                        <button onClick={() => updateQuantity(item.id_articulo, item.cantidad - 1)} style={{ padding: "2px 8px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>-</button>
                        <span style={{ padding: "0 8px", fontSize: "13px", fontWeight: "600" }}>{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.id_articulo, item.cantidad + 1)} style={{ padding: "2px 8px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>+</button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                          ${item.precio_venta * item.cantidad}
                        </span>
                        <button onClick={() => removeFromCart(item.id_articulo)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px" }} title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#374151" }}>Total</span>
                <span style={{ fontSize: "20px", fontWeight: "bold", color: "#059669" }}>${getSubtotal()}</span>
              </div>

              <button 
                onClick={() => setModalConfirmarOpen(true)}
                style={{ width: "100%", backgroundColor: "#111827", color: "#ffffff", padding: "14px", borderRadius: "8px", border: "none", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                CONTINUAR AL PEDIDO
              </button>
            </div>
          )}

        </div>
      </div>

      <ConfirmarPedidoModal 
        isOpen={modalConfirmarOpen} 
        onClose={() => { setModalConfirmarOpen(false); onClose(); }} 
        sucursalId={sucursalId} 
        sucursalNombre={sucursalNombre}
      />
    </>
  );
};
