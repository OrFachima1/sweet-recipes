// src/components/ErrorBoundary.tsx
import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // אפשר לדווח ל-logger
    console.error('ErrorBoundary', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-2">משהו השתבש.</h2>
          <p className="text-sm text-gray-600">רעננו את העמוד או נסו שוב מאוחר יותר.</p>
        </div>
      );
    }
    return this.props.children as any;
  }
}
