import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  sectionName: string;
  fallback?: ReactNode;
  onReset?: () => void;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Catches render-phase errors thrown by its children and displays a
 * fallback UI. It does NOT protect against errors thrown in the
 * PARENT component above the JSX return statement — those errors
 * unmount the route subtree before any child boundary mounts.
 *
 * For app-wide coverage of render-phase throws in route components,
 * see P-platform1 in the Design Map
 * (docs/Designs/scope-of-works-redesign.md).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary:${this.props.sectionName}]`, error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="error-boundary-fallback" role="alert">
        <p className="error-boundary-fallback__heading">
          This section couldn't be rendered.
        </p>
        <p className="error-boundary-fallback__sub">
          {this.props.sectionName} hit an unexpected error. Other parts of the
          page still work.
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--secondary s7-btn--sm"
          onClick={this.reset}
        >
          Try again
        </button>
      </div>
    );
  }
}
