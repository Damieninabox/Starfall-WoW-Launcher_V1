import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render errors in the whole app so a crash doesn't blank out
 * the UI and leave only the Starfield visible. The error text + stack
 * is rendered inline so we can diagnose without reaching for DevTools.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught", error, info);
    this.setState({ error, info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-red-900/60 bg-red-950/50 p-6 text-sm text-red-100 shadow-2xl">
          <div className="mb-2 text-lg font-semibold text-red-300">
            Launcher hit a render error
          </div>
          <div className="mb-3 font-mono text-xs text-red-200">
            {error.name}: {error.message}
          </div>
          {error.stack && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer text-red-300">Stack</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-[11px] text-red-200">
                {error.stack}
              </pre>
            </details>
          )}
          {info?.componentStack && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer text-red-300">
                Component tree
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-[11px] text-red-200">
                {info.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="rounded bg-red-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-red-400"
            >
              Try again
            </button>
            <button
              onClick={() => location.reload()}
              className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
            >
              Reload launcher
            </button>
          </div>
        </div>
      </div>
    );
  }
}
