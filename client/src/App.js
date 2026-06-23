import { useState } from 'react';
import Explorer from './components/Explorer';
import Science from './components/Science';
import Nav from './components/Nav';
import WelcomeModal from './components/WelcomeModal';

export default function App() {
  const [page, setPage] = useState('explorer');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)' }}>
      <WelcomeModal />
      <Nav page={page} setPage={setPage} />
      <main style={{ paddingTop: '56px' }}>
        {page === 'explorer' ? <Explorer /> : <Science />}
      </main>
    </div>
  );
}
