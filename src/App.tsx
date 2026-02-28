import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { WalletConnect } from './components/WalletConnect'
import { Landing } from './pages/Landing'
import { BatchSend } from './pages/BatchSend'
import { FundPool } from './pages/FundPool'

export default function App() {
    return (
        <BrowserRouter>
            <div className="app-layout">
                {/* Header */}
                <header className="app-header">
                    <NavLink to="/" className="app-header__logo">
                        <div className="app-header__logo-mark">BM</div>
                        BM-7702
                    </NavLink>
                    <nav className="app-header__nav">
                        <NavLink
                            to="/send"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            Batch Send
                        </NavLink>
                        <NavLink
                            to="/pool"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            Fund Pool
                        </NavLink>
                        <WalletConnect />
                    </nav>
                </header>

                {/* Main */}
                <main className="app-main">
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/send" element={<BatchSend />} />
                        <Route path="/pool" element={<FundPool />} />
                    </Routes>
                </main>

                {/* Footer */}
                <footer style={{
                    borderTop: '1px solid var(--border)',
                    padding: 'var(--space-md) var(--space-xl)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                }}>
                    <span>BM-7702 — EIP-7702 on Monad</span>
                    <span>Monad Testnet · Chain 10143</span>
                </footer>
            </div>
        </BrowserRouter>
    )
}
