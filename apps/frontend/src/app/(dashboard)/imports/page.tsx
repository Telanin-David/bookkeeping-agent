'use client';
import { useState } from 'react';
import { importsApi } from '@/lib/api';
import PageWrapper from '@/components/layout/PageWrapper';
import FileUpload from '@/components/imports/FileUpload';
import ColumnMapper from '@/components/imports/ColumnMapper';
import ValidationSummary from '@/components/imports/ValidationSummary';
import type { ExcelImport } from '@/types';

type Step = 'upload' | 'map' | 'validate' | 'done';

interface ValidationResult {
  importId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  qualityScore: number;
  errors: { row: number; field: string; message: string }[];
}

export default function ImportsPage() {
  const [step, setStep]           = useState<Step>('upload');
  const [job, setJob]             = useState<ExcelImport | null>(null);
  const [preview, setPreview]     = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function onUploaded(uploaded: ExcelImport) {
    setJob(uploaded);
    const { data } = await importsApi.preview(uploaded.id);
    setPreview(data.detectedColumns);
    setStep('map');
  }

  async function onMapped(mapping: Record<string, string>) {
    const { data } = await importsApi.validate(job!.id, mapping);
    setValidation(data as ValidationResult);
    setStep('validate');
  }

  async function onConfirm() {
    setConfirmLoading(true);
    try {
      await importsApi.confirm(job!.id);
      setStep('done');
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <PageWrapper title="Import Excel / CSV">
      <div className="max-w-xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'map', 'validate', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">›</span>}
              <span className={step === s ? 'font-semibold text-brand-600' : 'text-gray-400 capitalize'}>{s}</span>
            </div>
          ))}
        </div>

        {step === 'upload'   && <FileUpload onUploaded={onUploaded} />}
        {step === 'map'      && <ColumnMapper detectedColumns={preview} onSubmit={onMapped} />}
        {step === 'validate' && validation && (
          <ValidationSummary result={validation} onConfirm={onConfirm} loading={confirmLoading} />
        )}
        {step === 'done' && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold text-white/75">Import complete!</p>
            <p className="mt-1 text-sm text-white/50">Your transactions have been imported.</p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
