'use client';
import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { importsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import Button from '@/components/ui/Button';
import type { ExcelImport } from '@/types';

interface FileUploadProps {
  onUploaded: (job: ExcelImport) => void;
}

export default function FileUpload({ onUploaded }: FileUploadProps) {
  const activeShop = useShopsStore((s) => s.activeShop());
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function uploadFile(file: File) {
    if (!activeShop) { setError('Select a shop first'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await importsApi.upload(activeShop.id, file);
      onUploaded(data);
    } catch {
      setError('Upload failed. Ensure the file is .xlsx or .csv under 10 MB.');
    } finally {
      setLoading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all ${
        dragging
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <Upload size={20} className="text-amber-400" />
      </div>
      <p className="mb-1 text-sm font-medium text-white/70">Drop your file here</p>
      <p className="mb-4 text-xs text-white/30">.xlsx, .xls or .csv — max 10 MB</p>
      <label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
        <Button variant="secondary" loading={loading}>Browse file</Button>
      </label>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
