import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#fff', background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2>⚠️ ఏదో ఒక చిన్న సాంకేతిక లోపం తలెత్తింది.</h2>
          <p style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '300px', marginTop: '10px' }}>
            {this.state.error && this.state.error.toString()}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', background: '#fc8019', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            పేజీని రిఫ్రెష్ చేయండి 🔄
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;