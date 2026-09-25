'use client';
import { useQuery } from '@tanstack/react-query';
import { shopsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';

export function useShops() {
  const { shops, activeShopId, setShops, setActiveShop, activeShop } = useShopsStore();

  const query = useQuery({
    queryKey: ['shops'],
    queryFn: async () => {
      const { data } = await shopsApi.list();
      setShops(data);
      if (!activeShopId && data.length > 0) setActiveShop(data[0].id);
      return data;
    },
  });

  return { shops, activeShopId, activeShop: activeShop(), setActiveShop, isLoading: query.isLoading };
}
