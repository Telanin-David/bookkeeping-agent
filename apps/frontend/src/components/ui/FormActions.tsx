import type { ReactNode } from 'react';

/**
 * A form's buttons: full width and stacked on a phone, with the main one on top (put it
 * last); side by side on the right on wider screens. Give the buttons size="lg".
 */
export default function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:pt-1">{children}</div>;
}
