'use client';
import { createContext, useContext, useMemo, useState } from 'react';

// === Shop-Regeln ===
export const MIN_ORDER_CHF = 75;        // <- Mindestbestellwert (änderbar)
export const FREE_SHIP_FROM_CHF = 200;  // <- Gratis Versand ab CHF 200
export const SHIPPING_CHF = 7;          // <- Standard Versandkosten

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]); // [{id,title,price,qty,size,image}, ...]

  const add = (item) => {
    setCart((old) => {
      const key = `${item.id || item.image}__${item.size || 'default'}`;
      const found = old.find((it) => `${it.id || it.image}__${it.size || 'default'}` === key);
      if (found) {
        return old.map((it) =>
          it === found ? { ...it, qty: it.qty + (item.qty || 1) } : it
        );
      }
      return [...old, { ...item, qty: item.qty || 1 }];
    });
  };

  const remove = (keyFn) => {
    setCart((old) => old.filter((it, idx) => !keyFn(it, idx)));
  };

  const clear = () => setCart([]);

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + (Number(it.price) || 0) * (it.qty || 1), 0),
    [cart]
  );

  const shipping = useMemo(
    () => (subtotal >= FREE_SHIP_FROM_CHF || subtotal === 0 ? 0 : SHIPPING_CHF),
    [subtotal]
  );

  const isBelowMin = subtotal > 0 && subtotal < MIN_ORDER_CHF;
  const total = subtotal + shipping;

  const value = {
    cart,
    add,
    remove,
    clear,
    subtotal,
    shipping,
    total,
    isBelowMin,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
