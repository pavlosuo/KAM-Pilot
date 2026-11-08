declare module 'lucide-react/dynamic.mjs' {
  import type { ComponentType } from 'react';
  import type { LucideProps } from 'lucide-react';

  export type IconName = string;

  export const iconNames: string[];

  export const DynamicIcon: ComponentType<LucideProps & { name: IconName; fallback?: ComponentType<LucideProps> }>;
}
