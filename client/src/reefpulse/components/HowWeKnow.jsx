import { useRef } from 'react';

export default function HowWeKnow({ t }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className="pill pill--icon" aria-label={t.how} title={t.how} onClick={() => ref.current?.showModal()}>?</button>
      <dialog ref={ref} aria-labelledby="rp-how-title">
        <h2 id="rp-how-title">{t.how}</h2>
        <ul>{t.howItems.map((h) => <li key={h}>{h}</li>)}</ul>
        <button type="button" className="pill" onClick={() => ref.current?.close()}>{t.close}</button>
      </dialog>
    </>
  );
}
