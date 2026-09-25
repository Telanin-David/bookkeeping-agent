import { shopsApi, type BrandingKind } from '@/lib/api';
import { isDemoShop } from '@/lib/demo';
import { useShopsStore } from '@/store/shops';
import type { Shop } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024;

// Receipt printers are black and white, so the preview should show exactly what will print.
export async function toPrintableImage(file: Blob, maxW = 600, maxH = 300): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Choose a PNG or JPG image.');
  if (file.size > MAX_BYTES) throw new Error('That image is over 5 MB. Choose a smaller one.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image. Try a different file.");
  }

  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function saveBranding(shop: Shop, kind: BrandingKind, dataUrl: string | null): Promise<Shop> {
  let updated: Shop;
  if (isDemoShop(shop.id)) {
    // No backend in demo mode: keep the image on this device only.
    updated = { ...shop, [kind === 'logo' ? 'logoUrl' : 'signatureUrl']: dataUrl };
  } else if (dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    updated = (await shopsApi.uploadBranding(shop.id, kind, blob)).data;
  } else {
    updated = (await shopsApi.removeBranding(shop.id, kind)).data;
  }
  const { shops, setShops } = useShopsStore.getState();
  setShops(shops.map((s) => (s.id === updated.id ? updated : s)));
  return updated;
}
