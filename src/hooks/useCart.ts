import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id_articulo: number;
  codigo: string;
  nombre: string;
  precio_venta: number;
  cantidad: number;
  stock_disponible: number;
  imagen_url?: string | null;
}

interface CartState {
  items: CartItem[];
  sucursalId: number | null;
  
  setSucursalId: (id: number) => void;
  addToCart: (product: Omit<CartItem, 'cantidad'>, cantidadDeseada?: number) => void;
  updateQuantity: (id_articulo: number, nuevaCantidad: number) => void;
  removeFromCart: (id_articulo: number) => void;
  clearCart: () => void;
  
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      sucursalId: null,

      setSucursalId: (nuevoId: number) => {
        const { sucursalId } = get();
        if (sucursalId !== null && sucursalId !== nuevoId) {
          set({ sucursalId: nuevoId, items: [] }); 
        } else {
          set({ sucursalId: nuevoId });
        }
      },

      addToCart: (product, cantidadDeseada = 1) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.id_articulo === product.id_articulo
          );

          if (existingIndex > -1) {
            const updatedItems = [...state.items];
            const currentItem = updatedItems[existingIndex];
            const nuevaCantidad = currentItem.cantidad + cantidadDeseada;

            if (nuevaCantidad > currentItem.stock_disponible) {
              alert(`No puedes agregar más unidades. Stock disponible: ${currentItem.stock_disponible}`);
              return state;
            }

            updatedItems[existingIndex] = { ...currentItem, cantidad: nuevaCantidad };
            return { items: updatedItems };
          } else {
            if (cantidadDeseada > product.stock_disponible) {
              alert(`Stock insuficiente. Disponible: ${product.stock_disponible}`);
              return state;
            }

            return {
              items: [...state.items, { ...product, cantidad: cantidadDeseada }],
            };
          }
        });
      },

      updateQuantity: (id_articulo: number, nuevaCantidad: number) => {
        if (nuevaCantidad <= 0) {
          get().removeFromCart(id_articulo);
          return;
        }

        set((state) => {
          const updatedItems = state.items.map((item) => {
            if (item.id_articulo === id_articulo) {
              if (nuevaCantidad > item.stock_disponible) {
                alert(`Stock máximo alcanzado para este producto (${item.stock_disponible} unidades).`);
                return item;
              }
              return { ...item, cantidad: Math.floor(nuevaCantidad) };
            }
            return item;
          });
          return { items: updatedItems };
        });
      },

      removeFromCart: (id_articulo: number) => {
        set((state) => ({
          items: state.items.filter((item) => item.id_articulo !== id_articulo),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((acc, item) => acc + item.cantidad, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((acc, item) => acc + item.precio_venta * item.cantidad, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
