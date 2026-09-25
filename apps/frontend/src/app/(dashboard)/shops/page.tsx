'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import PageWrapper from '@/components/layout/PageWrapper';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Shop } from '@/types';

const schema = z.object({
  name:     z.string().min(1),
  type:     z.enum(['retail', 'wholesale', 'services', 'food', 'other']),
  location: z.string().optional(),
  currency: z.string().default('NGN'),
});

type Form = z.infer<typeof schema>;

export default function ShopsPage() {
  const qc = useQueryClient();
  const { activeShopId, setActiveShop, setShops } = useShopsStore();
  const [showCreate, setShowCreate] = useState(false);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => shopsApi.list().then((r) => { setShops(r.data); return r.data; }),
  });

  const createMut = useMutation({
    mutationFn: (body: Form) => shopsApi.create(body).then((r) => r.data),
    onSuccess: (shop) => {
      qc.setQueryData<Shop[]>(['shops'], (old = []) => [...old, shop]);
      setShowCreate(false);
    },
  });

  const switchMut = useMutation({
    mutationFn: (shopId: string) => shopsApi.switchActive(shopId).then((r) => r.data),
    onSuccess: (data) => setActiveShop(data.activeShopId),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'NGN', type: 'retail' },
  });

  return (
    <PageWrapper title="Shops" actions={<Button onClick={() => setShowCreate(true)}>+ Add shop</Button>}>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner className="h-4 w-4" /> Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <div key={shop.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{shop.name}</h3>
                {activeShopId === shop.id && <Badge color="green">Active</Badge>}
              </div>
              <p className="text-sm text-gray-500 capitalize">{shop.type}{shop.location ? ` · ${shop.location}` : ''}</p>
              <p className="text-xs text-gray-400 mt-1">{shop.currency}</p>
              {activeShopId !== shop.id && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => switchMut.mutate(shop.id)}
                  loading={switchMut.isPending}
                >
                  Switch to this shop
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create shop">
        <form onSubmit={handleSubmit((v) => createMut.mutateAsync(v))} className="space-y-4">
          <Input id="name"     label="Shop name"  error={errors.name?.message}     {...register('name')} />
          <Input id="location" label="Location"   error={errors.location?.message} {...register('location')} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select {...register('type')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {['retail','wholesale','services','food','other'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <Input id="currency" label="Currency" error={errors.currency?.message} {...register('currency')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Create</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
