'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Stamp, Storefront } from '@phosphor-icons/react';
import { shopsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import PageWrapper from '@/components/layout/PageWrapper';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import IconButton from '@/components/ui/IconButton';
import FormActions from '@/components/ui/FormActions';
import { ListSkeleton } from '@/components/ui/Skeleton';
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
  const { shops, activeShopId, setActiveShop, setShops } = useShopsStore();
  const [showCreate, setShowCreate] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => shopsApi.list().then((data) => { setShops(data); return data; }),
  });

  const createMut = useMutation({
    mutationFn: (body: Form) => shopsApi.create(body).then((r) => r.data),
    onSuccess: (shop) => {
      qc.setQueryData<Shop[]>(['shops'], (old = []) => [...old, shop]);
      setShops([...shops, shop]);
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
    <PageWrapper
      title="Shops"
      actions={
        <>
          {/* On a phone, receipt branding is in the ⋯ menu, so the header keeps one button. */}
          <Link
            href="/shops/branding"
            className="hidden h-9 items-center gap-2 rounded-xl px-3 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white/90 sm:flex"
          >
            <Stamp size={16} />
            Receipt branding
          </Link>
          <Button className="hidden sm:inline-flex" onClick={() => setShowCreate(true)}>+ Add shop</Button>
          <IconButton className="sm:hidden" aria-label="Add a shop" onClick={() => setShowCreate(true)}><Plus size={20} weight="bold" /></IconButton>
        </>
      }
    >
      {isLoading && shops.length === 0 ? (
        <ListSkeleton rows={2} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <div key={shop.id} className="glass-card rounded-2xl p-5 transition-all hover:bg-white/[0.06]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg glass">
                    <Storefront size={16} className="text-white/50" />
                  </div>
                  <h3 className="font-semibold text-white/90 leading-tight">{shop.name}</h3>
                </div>
                {activeShopId === shop.id && <Badge>Active</Badge>}
              </div>
              <p className="text-sm text-white/40 capitalize">{shop.type}{shop.location ? ` · ${shop.location}` : ''}</p>
              <p className="mt-0.5 text-xs text-white/25">{shop.currency}</p>
              {activeShopId !== shop.id && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4"
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add a shop">
        <form onSubmit={handleSubmit((v) => createMut.mutateAsync(v))} className="space-y-4">
          <Input id="name"     label="Shop name"  error={errors.name?.message}     {...register('name')} />
          <Input id="location" label="Location"   error={errors.location?.message} {...register('location')} />
          <Select id="shop-type" label="Type" {...register('type')}>
            {['retail','wholesale','services','food','other'].map((t) => (
              <option key={t} value={t} className="bg-ink-900">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </Select>
          <Input id="currency" label="Currency" error={errors.currency?.message} {...register('currency')} />
          <FormActions>
            <Button type="button" size="lg" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={isSubmitting}>Create shop</Button>
          </FormActions>
        </form>
      </Modal>
    </PageWrapper>
  );
}
