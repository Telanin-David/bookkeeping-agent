import type { ReactNode } from 'react';

interface PageWrapperProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageWrapper({ title, actions, children }: PageWrapperProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4 md:px-6">
        <h1 className="text-base font-semibold text-white/90 md:text-lg">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
    </div>
  );
}
