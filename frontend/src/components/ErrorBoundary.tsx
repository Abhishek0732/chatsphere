import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback; defaults to the built-in "something went wrong" card. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in the subtree so one bad component shows a
 * recoverable card instead of blanking the whole app to a white screen.
 *
 * "Try again" clears the error and re-renders in place (enough for a transient
 * glitch); "Reload" does a hard reload for anything stickier.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the console (and any attached error reporter) for diagnosis.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="max-w-sm space-y-3 rounded-2xl glass-panel p-6">
          <h1 className="text-lg font-semibold text-on-surface">Something went wrong</h1>
          <p className="text-sm text-on-surface-variant">
            An unexpected error interrupted the app. Your data is safe — try again, or reload
            if it keeps happening.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              onClick={this.reset}
              className="rounded-xl bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="message-gradient-sent rounded-xl px-4 py-2 text-sm font-semibold text-on-primary shadow transition active:scale-[0.98]"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
