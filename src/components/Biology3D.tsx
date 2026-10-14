import { Component, type ErrorInfo, type ReactNode } from 'react';
import HumanAtlas from './human-atlas/HumanAtlas';

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { error: string }

class Biology3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error.message : 'Vizualizatorul 3D nu a putut porni.' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Biologie 3D failed to render.', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <section className="flex min-h-[420px] items-center justify-center p-6" role="alert">
        <div className="max-w-lg rounded-3xl border border-[#174b3d]/15 bg-white p-8 text-center shadow-xl shadow-[#174b3d]/10">
          <h1 className="font-serif text-3xl font-semibold text-[#123c32]">Biologie 3D nu a putut porni</h1>
          <p className="mt-3 text-[#536b64]">{this.state.error}</p>
          <button type="button" className="mt-6 rounded-xl bg-[#176b54] px-6 py-3 font-semibold text-white" onClick={() => window.location.reload()}>Reîncarcă pagina</button>
        </div>
      </section>;
    }
    return this.props.children;
  }
}

export default function Biology3D() {
  return <Biology3DErrorBoundary><HumanAtlas /></Biology3DErrorBoundary>;
}
