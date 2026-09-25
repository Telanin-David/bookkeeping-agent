import type { ReactNode } from 'react';

interface PageWrapperProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageWrapper({ title, actions, children }: PageWrapperProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
