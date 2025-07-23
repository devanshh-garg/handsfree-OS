'use client';

import dynamic from 'next/dynamic';

const ToastContainer = dynamic(
  () => import('./Toast').then(mod => mod.ToastContainer),
  { ssr: false }
);

export function ToastWrapper() {
  return <ToastContainer />;
}