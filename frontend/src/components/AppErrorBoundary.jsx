import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('LIVO UI crash', error, info);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center bg-[#E8ECF4] p-6 text-center">
        <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-6 shadow-card ring-1 ring-slate-200">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 text-rose-500 grid place-items-center text-2xl font-black">!</div>
          <h1 className="mt-4 font-heading text-xl font-extrabold text-ink">Valami félrement.</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">
            A tanulási adataid ettől nem törlődnek. Frissítsd újra az alkalmazást.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-full bg-brand py-3.5 font-semibold text-white active:scale-95 transition-transform"
          >
            LIVO újratöltése
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <details className="mt-4 text-left text-xs text-slate-500">
              <summary>Fejlesztői hiba</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{String(this.state.error?.message || this.state.error)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
