interface TransactionStatusProps {
    status: 'idle' | 'signing' | 'pending' | 'success' | 'error'
    hash?: string
    error?: string
    explorerUrl?: string
}

const statusConfig = {
    idle: { icon: '—', label: 'Ready', className: '' },
    signing: { icon: '✎', label: 'Awaiting Signature...', className: 'tx-status--pending' },
    pending: { icon: '◌', label: 'Transaction Pending...', className: 'tx-status--pending' },
    success: { icon: '✓', label: 'Transaction Confirmed', className: 'tx-status--success' },
    error: { icon: '✕', label: 'Transaction Failed', className: 'tx-status--error' },
}

export function TransactionStatus({ status, hash, error, explorerUrl }: TransactionStatusProps) {
    if (status === 'idle') return null

    const cfg = statusConfig[status]

    return (
        <div className={`tx-status animate-in ${cfg.className}`}>
            <div className="tx-status__icon" style={status === 'pending' || status === 'signing' ? { animation: 'spin 1s linear infinite' } : undefined}>
                {cfg.icon}
            </div>
            <div className="tx-status__content">
                <div className="tx-status__title">{cfg.label}</div>
                {hash && (
                    <div className="tx-status__hash">
                        {explorerUrl ? (
                            <a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                                {hash}
                            </a>
                        ) : (
                            hash
                        )}
                    </div>
                )}
                {error && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--error)', marginTop: '4px' }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    )
}
