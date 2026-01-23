import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div style={{
    padding: '20px',
    background: '#1a1a1a',
    color: '#e2e8f0',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '20px auto'
  }}>
    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
      Something went wrong
    </h3>
    <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.8 }}>
      {error.message || 'An unexpected error occurred'}
    </p>
    <button
      onClick={retry}
      style={{
        padding: '8px 16px',
        background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
        color: '#e2e8f0',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500
      }}
    >
      Try Again
    </button>
  </div>
);

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error details for debugging
    console.group('React Error Boundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.groupEnd();
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;