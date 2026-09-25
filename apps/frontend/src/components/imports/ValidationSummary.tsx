import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ValidationResult {
  importId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  qualityScore: number;
  errors: { row: number; field: string; message: string }[];
}

interface ValidationSummaryProps {
  result: ValidationResult;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export default function ValidationSummary({ result, onConfirm, loading }: ValidationSummaryProps) {
  const pct = Math.round(result.qualityScore * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{result.validRows}</p>
          <p className="text-xs text-white/40 mt-0.5">Valid rows</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{result.errorRows}</p>
          <p className="text-xs text-white/40 mt-0.5">Error rows</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{pct}%</p>
          <p className="text-xs text-white/40 mt-0.5">Quality score</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="max-h-40 overflow-y-auto glass rounded-xl p-3 space-y-1">
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-400">
              Row {e.row} · <strong className="text-red-300">{e.field}</strong>: {e.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onConfirm} loading={loading} disabled={result.validRows === 0}>
          Import {result.validRows} rows
        </Button>
        {result.errorRows > 0 && (
          <Badge color="yellow">{result.errorRows} rows will be skipped</Badge>
        )}
      </div>
    </div>
  );
}
