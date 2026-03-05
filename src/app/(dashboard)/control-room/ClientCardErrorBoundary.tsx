"use client";

import { Component, type ReactNode } from "react";

interface Props {
  clientName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ClientCardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[ClientCard] Error rendering ${this.props.clientName}:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium text-red-400">{this.props.clientName}</p>
          <p className="text-xs text-zinc-500">Kon niet laden — herlaad de pagina</p>
        </div>
      );
    }

    return this.props.children;
  }
}
