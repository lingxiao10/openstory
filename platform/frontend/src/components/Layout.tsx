import { ReactNode } from 'react';
import { Header } from './Header';

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
        {children}
      </main>
    </div>
  );
}
