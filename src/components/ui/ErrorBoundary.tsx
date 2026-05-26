import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown above the message — e.g. the screen name. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree so one screen crashing
 * doesn't blank the whole app. Renders a recoverable fallback with a
 * "Try again" button that resets the boundary.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[pindrapp] screen crashed:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 12,
            padding: 24,
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--text-primary)',
            }}
          >
            {this.props.label ? `${this.props.label} hit a snag` : 'Something went wrong'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, maxWidth: 280 }}>
            This screen ran into an error. The rest of the app is still fine.
          </div>
          <button
            type="button"
            onClick={this.reset}
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--orange)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
