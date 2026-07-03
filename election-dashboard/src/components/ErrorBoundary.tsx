"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(0.7 0.15 60)" }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Bir şeyler ters gitti
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
              Beklenmeyen bir hata oluştu.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            >
              <RefreshCw className="w-4 h-4" />
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
