'use client';
import { useQuery } from '@tanstack/react-query';
import { shopsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import { useAuthStore } from '@/store/auth';
import { DEMO_USER_ID } from '@/lib/demo';

export function useShops() {
  const { shops, activeShopId, setShops, setActiveShop, activeShop } = useShopsStore();
  const { isAuthenticated, user } = useAuthStore();

  const query = useQuery({
    queryKey: ['shops'],
    queryFn: async () => {
      const data = await shopsApi.list();
      setShops(data);
      // Also covers an active shop left over from a previous session on this device.
      if (data.length > 0 && !data.some((s) => s.id === useShopsStore.getState().activeShopId)) {
        setActiveShop(data[0].id);
      }
      return data;
    },
    enabled: isAuthenticated && user?.id !== DEMO_USER_ID,
  });

  return {
    shops, activeShopId, activeShop: activeShop(), setActiveShop,
    isLoading: query.isLoading, fetched: query.data,
  };
}
