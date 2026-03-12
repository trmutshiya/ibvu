import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", background: "#fff8f8", border: "1px solid #f5c6cb", borderRadius: 8, margin: 24 }}>
          <strong style={{ color: "#c62828" }}>⚠ Render error (for debugging):</strong>
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", fontSize: 12, color: "#333" }}>
            {this.state.error.toString()}{"\n"}{this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
