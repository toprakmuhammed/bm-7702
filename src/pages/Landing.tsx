import { useNavigate } from 'react-router-dom'

export function Landing() {
    const navigate = useNavigate()

    return (
        <div className="animate-in">
            {/* Hero */}
            <div className="hero">
                <h1 className="hero__title">
                    One TX.<br />
                    Dozens of<br />
                    Wallets.
                </h1>
                <p className="hero__subtitle">
                    Batch distribute tokens across multiple wallets in a single transaction.
                    Powered by EIP-7702 on Monad.
                </p>
                <div className="hero__actions">
                    <button className="btn btn--primary btn--lg" onClick={() => navigate('/send')}>
                        Batch Send →
                    </button>
                    <button className="btn btn--lg" onClick={() => navigate('/pool')}>
                        Fund Pool →
                    </button>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="feature-grid">
                <div className="feature-item">
                    <div className="feature-item__number">01</div>
                    <div className="feature-item__title">Batch Send</div>
                    <div className="feature-item__desc">
                        Add recipients manually or import from CSV. Send MON or any ERC-20 token to all of them in one transaction.
                    </div>
                </div>
                <div className="feature-item">
                    <div className="feature-item__number">02</div>
                    <div className="feature-item__title">Fund Pool</div>
                    <div className="feature-item__desc">
                        Set a budget, track what's been used, and distribute the remainder to your team with equal or custom splits.
                    </div>
                </div>
                <div className="feature-item">
                    <div className="feature-item__number">03</div>
                    <div className="feature-item__title">EIP-7702</div>
                    <div className="feature-item__desc">
                        Your EOA temporarily gains smart contract powers. No contract wallet migration. No approvals. Just sign and send.
                    </div>
                </div>
                <div className="feature-item">
                    <div className="feature-item__number">04</div>
                    <div className="feature-item__title">Monad</div>
                    <div className="feature-item__desc">
                        Built on Monad's high-performance L1. 10,000 TPS, sub-second finality, full EVM compatibility.
                    </div>
                </div>
            </div>

            {/* Protocol Explainer */}
            <div className="mt-xl">
                <div className="card" style={{ borderWidth: '2px' }}>
                    <div className="card__header">
                        <span className="card__title">How It Works</span>
                        <span className="tag">EIP-7702</span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
                        {[
                            { step: '01', title: 'Connect', desc: 'Connect your wallet to Monad Testnet' },
                            { step: '02', title: 'Configure', desc: 'Add recipients and amounts or set up a fund pool' },
                            { step: '03', title: 'Sign', desc: 'Sign EIP-7702 authorization — your EOA gains batch powers' },
                            { step: '04', title: 'Execute', desc: 'All transfers happen in a single atomic transaction' },
                        ].map((s) => (
                            <div key={s.step} style={{ flex: 1, minWidth: '180px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    {s.step}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {s.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    {s.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
