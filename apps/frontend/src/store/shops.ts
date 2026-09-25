import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Shop } from '@/types';

interface ShopsState {
  shops: Shop[];
  activeShopId: string | null;
  setShops: (shops: Shop[]) => void;
  setActiveShop: (shopId: string) => void;
  activeShop: () => Shop | null;
}

export const useShopsStore = create<ShopsState>()(
  persist(
    (set, get) => ({
      shops: [],
      activeShopId: null,

      setShops: (shops) => set({ shops }),

      setActiveShop: (shopId) => set({ activeShopId: shopId }),

      activeShop: () => {
        const { shops, activeShopId } = get();
        return shops.find((s) => s.id === activeShopId) ?? null;
      },
    }),
    { name: 'bookkeeping-shops' },
  ),
);
