'use client';
import { useCallback, useState } from 'react';
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
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50'
      }`}
    >
      <p className="mb-3 text-sm text-gray-500">Drag & drop an Excel or CSV file, or</p>
      <label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
        <Button as="span" loading={loading}>Browse file</Button>
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
