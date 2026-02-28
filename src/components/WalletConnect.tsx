import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'

export function WalletConnect() {
    const { address, isConnected } = useAccount()
    const { connect, isPending } = useConnect()
    const { disconnect } = useDisconnect()
    const { data: balance } = useBalance({ address })

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-sm">
                <div className="flex flex-col items-center gap-xs" style={{ alignItems: 'flex-end' }}>
                    <span className="wallet-addr">
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    {balance && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                        </span>
                    )}
                </div>
                <button
                    className="wallet-btn wallet-btn--connected"
                    onClick={() => disconnect()}
                >
                    ✕
                </button>
            </div>
        )
    }

    return (
        <button
            className="wallet-btn"
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
        >
            {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
    )
}
