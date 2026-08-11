import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes condicionais e resolve conflitos de utilitários Tailwind —
 * a última classe vence. Exigido pelo código do shadcn/ui (design §6.1).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
