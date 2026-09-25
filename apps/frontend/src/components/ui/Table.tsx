import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export default function Table<T extends Record<string, unknown>>({
  columns, data, keyExtractor, onRowClick, emptyMessage = 'No records found', className,
}: TableProps<T>) {
  return (
    <div className={cn('glass-card overflow-x-auto rounded-2xl', className)}>
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/35">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-sm text-white/30">
                {emptyMessage}
              </td>
            </tr>
          ) : data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-white/[0.04] last:border-0 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-white/[0.03]',
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-sm text-white/75', col.className)}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
