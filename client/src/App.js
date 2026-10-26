import { Analytics } from '@vercel/analytics/react';
import ReefPulse from './reefpulse/ReefPulse';

export default function App() {
  return (
    <>
      <ReefPulse />
      <Analytics />
    </>
  );
}
