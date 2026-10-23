import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

/** Privacy Policy / Terms layout: title, sticky table of contents, document body. */
export function LegalPage({ title, updated, toc, children }: {
  title: string;
  updated: string;
  toc: readonly (readonly [string, string])[];
  children: React.ReactNode;
}) {
  return (
    <div className="page" style={{ background: '#FFFFFF' }}>
      <a className="skip-link" href="#doc">Skip to content</a>
      <SiteHeader variant="legal" />
      {/* TODO (owner): have a Georgia attorney review both documents before launch. */}
      <main className="wrap" style={{ paddingTop: 56, paddingBottom: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40, maxWidth: 720 }}>
          <h1 className="display" style={{ fontSize: 40, lineHeight: '48px' }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>Last updated {updated}</p>
        </div>
        <div className="lg-grid">
          <nav className="toc-wrap" aria-label="On this page">
            <p className="toc-head">On this page</p>
            <ul className="toc">
              {toc.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}
            </ul>
          </nav>
          <article id="doc" className="doc">{children}</article>
        </div>
      </main>
      <SiteFooter variant="legal" />
    </div>
  );
}
