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
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{result.validRows}</p>
          <p className="text-xs text-green-600">Valid rows</p>
        </div>
        <div className="flex-1 rounded-lg bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{result.errorRows}</p>
          <p className="text-xs text-red-600">Error rows</p>
        </div>
        <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{pct}%</p>
          <p className="text-xs text-blue-600">Quality score</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700">
              Row {e.row} · <strong>{e.field}</strong>: {e.message}
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
