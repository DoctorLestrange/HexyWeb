import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error): void {
    console.error('Hexy runtime error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              Something went wrong
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Hexy encountered an unexpected display error. Your files and local data remain private
              in your browser.
            </p>
            {this.state.errorMessage && (
              <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs text-[var(--danger)] break-words">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Reload Hexy
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
