'use client';

// Last resort if the whole layout fails: plain HTML, no site styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, color: '#16211F' }}>
        <h1>Sorry — Fernhouse didn’t load.</h1>
        <p>Please try again, or call or text (678) 439-6213.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 20px' }}>Try again</button>
      </body>
    </html>
  );
}
