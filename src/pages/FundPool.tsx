import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useEIP7702, Recipient, validateRecipients } from '../hooks/useEIP7702'
import { TransactionStatus } from '../components/TransactionStatus'

interface PoolMember {
    address: string
    share: string // percentage or fixed amount
}

type DistMode = 'equal' | 'custom'

export function FundPool() {
    const { isConnected } = useAccount()
    const { txStatus, txHash, txError, executeBatch, buildNativeCalls, buildERC20Calls, readTokenDecimals, reset, explorerUrl } = useEIP7702()

    const [poolName, setPoolName] = useState('')
    const [totalBudget, setTotalBudget] = useState('')
    const [usedAmount, setUsedAmount] = useState('')
    const [tokenType, setTokenType] = useState<'native' | 'erc20'>('native')
    const [tokenAddress, setTokenAddress] = useState('')
    const [distMode, setDistMode] = useState<DistMode>('equal')
    const [validationError, setValidationError] = useState<string>()
    const [members, setMembers] = useState<PoolMember[]>([
        { address: '', share: '' },
        { address: '', share: '' },
    ])

    const addMember = () => {
        setMembers(prev => [...prev, { address: '', share: '' }])
    }

    const removeMember = (index: number) => {
        setMembers(prev => prev.filter((_, i) => i !== index))
    }

    const updateMember = (index: number, field: keyof PoolMember, value: string) => {
        setMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
        setValidationError(undefined)
    }

    // Calculate distribution
    const budget = parseFloat(totalBudget) || 0
    const used = parseFloat(usedAmount) || 0
    const remaining = Math.max(0, budget - used)
    const validMembers = members.filter(m => m.address)
    const perPerson = distMode === 'equal' && validMembers.length > 0
        ? remaining / validMembers.length
        : 0

    const getDistributionRecipients = useCallback((): Recipient[] => {
        const currentValidMembers = members.filter(m => m.address)
        const currentRemaining = Math.max(0, (parseFloat(totalBudget) || 0) - (parseFloat(usedAmount) || 0))

        if (distMode === 'equal') {
            const share = currentValidMembers.length > 0 ? currentRemaining / currentValidMembers.length : 0
            return currentValidMembers.map(m => ({
                address: m.address,
                amount: share.toString(),
            }))
        } else {
            return currentValidMembers.map(m => ({
                address: m.address,
                amount: m.share || '0',
            }))
        }
    }, [distMode, members, totalBudget, usedAmount])

    const customTotal = distMode === 'custom'
        ? validMembers.reduce((sum, m) => sum + (parseFloat(m.share) || 0), 0)
        : 0

    const handleDistribute = async () => {
        const distributionRecipients = getDistributionRecipients()
        if (distributionRecipients.length === 0) return

        // Validate addresses
        const error = validateRecipients(distributionRecipients)
        if (error) {
            setValidationError(error)
            return
        }
        setValidationError(undefined)

        let calls
        if (tokenType === 'native') {
            calls = buildNativeCalls(distributionRecipients)
        } else {
            if (!tokenAddress) return
            const decimals = await readTokenDecimals(tokenAddress)
            calls = buildERC20Calls(tokenAddress, distributionRecipients, decimals)
        }

        await executeBatch(calls)
    }

    const usedPercent = budget > 0 ? (used / budget) * 100 : 0

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-header__title">Fund Pool</h1>
                <p className="page-header__desc">
                    Distribute remaining funds to team members with one click. Set budget, add members, choose split method.
                </p>
            </div>

            {/* Pool Setup */}
            <div className="section">
                <div className="section__title">Pool Configuration</div>
                <div className="card">
                    <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label className="input-label">Pool Name</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="e.g. Hackathon Grant"
                                value={poolName}
                                onChange={(e) => setPoolName(e.target.value)}
                            />
                        </div>
                        <div className="input-group" style={{ minWidth: '180px' }}>
                            <label className="input-label">Token</label>
                            <select
                                className="input"
                                value={tokenType}
                                onChange={(e) => setTokenType(e.target.value as 'native' | 'erc20')}
                            >
                                <option value="native">MON (Native)</option>
                                <option value="erc20">ERC-20 Token</option>
                            </select>
                        </div>
                    </div>

                    {tokenType === 'erc20' && (
                        <div className="input-group mb-lg">
                            <label className="input-label">Token Contract Address</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="0x..."
                                value={tokenAddress}
                                onChange={(e) => setTokenAddress(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
                            <label className="input-label">Total Budget</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="50000"
                                value={totalBudget}
                                onChange={(e) => setTotalBudget(e.target.value)}
                            />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
                            <label className="input-label">Amount Used</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="25000"
                                value={usedAmount}
                                onChange={(e) => setUsedAmount(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Budget Overview */}
            {budget > 0 && (
                <div className="summary-bar">
                    <div className="stat">
                        <span className="stat__label">Total Budget</span>
                        <span className="stat__value stat__value--sm">
                            {budget.toLocaleString()} {tokenType === 'native' ? 'MON' : 'Tokens'}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat__label">Used</span>
                        <span className="stat__value stat__value--sm" style={{ color: 'var(--text-muted)' }}>
                            {used.toLocaleString()}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat__label">Remaining</span>
                        <span className="stat__value stat__value--sm" style={{ color: 'var(--success)' }}>
                            {remaining.toLocaleString()}
                        </span>
                    </div>
                    <div className="stat" style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <span className="stat__label">{usedPercent.toFixed(0)}% Used</span>
                        <div className="progress-bar" style={{ marginTop: '8px' }}>
                            <div className="progress-bar__fill" style={{ width: `${Math.min(100, usedPercent)}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Distribution Mode */}
            <div className="section">
                <div className="section__title">Distribution</div>
                <div className="tabs">
                    <button
                        className={`tab ${distMode === 'equal' ? 'active' : ''}`}
                        onClick={() => setDistMode('equal')}
                    >
                        Equal Split
                    </button>
                    <button
                        className={`tab ${distMode === 'custom' ? 'active' : ''}`}
                        onClick={() => setDistMode('custom')}
                    >
                        Custom Amounts
                    </button>
                </div>

                {/* Members Table */}
                <div className="flex gap-sm mb-md">
                    <button className="btn btn--sm" onClick={addMember}>
                        + Add Member
                    </button>
                    {members.length > 1 && (
                        <button
                            className="btn btn--sm btn--danger"
                            onClick={() => {
                                setMembers([{ address: '', share: '' }])
                                setValidationError(undefined)
                            }}
                        >
                            Clear All
                        </button>
                    )}
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>Wallet Address</th>
                                {distMode === 'custom' && <th style={{ width: '180px' }}>Amount</th>}
                                {distMode === 'equal' && <th style={{ width: '180px' }}>Share</th>}
                                <th style={{ width: '60px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((m, i) => (
                                <tr key={i} className="animate-row" style={{ animationDelay: `${i * 30}ms` }}>
                                    <td style={{ color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</td>
                                    <td>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder="0x..."
                                            value={m.address}
                                            onChange={(e) => updateMember(i, 'address', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        {distMode === 'equal' ? (
                                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                {m.address ? perPerson.toFixed(4) : '—'}
                                            </span>
                                        ) : (
                                            <input
                                                className="input"
                                                type="text"
                                                placeholder="0.0"
                                                value={m.share}
                                                onChange={(e) => updateMember(i, 'share', e.target.value)}
                                            />
                                        )}
                                    </td>
                                    <td>
                                        {members.length > 1 && (
                                            <button
                                                className="btn btn--sm btn--danger"
                                                onClick={() => removeMember(i)}
                                                style={{ padding: '2px 8px', minHeight: 'unset', border: 'none' }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Custom mode total check */}
                {distMode === 'custom' && customTotal > 0 && (
                    <div className="mt-md" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Custom total: </span>
                        <span style={{ color: customTotal > remaining ? 'var(--error)' : 'var(--success)' }}>
                            {customTotal.toFixed(4)}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}> / {remaining.toFixed(4)} remaining</span>
                        {customTotal > remaining && (
                            <span style={{ color: 'var(--error)', marginLeft: '8px' }}>
                                ⚠ Exceeds remaining budget
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Pool Preview Card */}
            {poolName && budget > 0 && validMembers.length > 0 && (
                <div className="section">
                    <div className="section__title">Preview</div>
                    <div className="pool-card">
                        <div className="pool-card__header">
                            <div>
                                <div className="pool-card__name">{poolName}</div>
                                <div className="tag mt-sm">{validMembers.length} members</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Distributing
                                </div>
                                <div className="pool-card__budget">
                                    {remaining.toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tokenType === 'native' ? 'MON' : 'Tokens'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="pool-card__members">
                            {validMembers.map((m, i) => (
                                <div key={i} className="pool-member">
                                    <span className="pool-member__addr">
                                        {m.address.slice(0, 8)}...{m.address.slice(-6)}
                                    </span>
                                    <span className="pool-member__amount">
                                        {distMode === 'equal' ? perPerson.toFixed(4) : (parseFloat(m.share) || 0).toFixed(4)}
                                        {' '}{tokenType === 'native' ? 'MON' : 'Tokens'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Error */}
            {validationError && (
                <div className="tx-status tx-status--error animate-in mb-lg">
                    <div className="tx-status__icon">⚠</div>
                    <div className="tx-status__content">
                        <div className="tx-status__title">Validation Error</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--error)', marginTop: '4px' }}>
                            {validationError}
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Status */}
            <TransactionStatus
                status={txStatus}
                hash={txHash}
                error={txError}
                explorerUrl={explorerUrl}
            />

            {/* Distribute Button */}
            <div className="mt-lg flex gap-md">
                {txStatus === 'success' || txStatus === 'error' ? (
                    <button className="btn btn--primary btn--lg btn--full" onClick={reset}>
                        New Distribution
                    </button>
                ) : (
                    <button
                        className={`btn btn--primary btn--lg btn--full ${txStatus !== 'idle' ? 'btn--loading' : ''}`}
                        onClick={handleDistribute}
                        disabled={
                            !isConnected ||
                            validMembers.length === 0 ||
                            remaining <= 0 ||
                            txStatus !== 'idle' ||
                            (distMode === 'custom' && customTotal > remaining)
                        }
                    >
                        {!isConnected
                            ? 'Connect Wallet First'
                            : validMembers.length === 0
                                ? 'Add Team Members'
                                : remaining <= 0
                                    ? 'No Funds to Distribute'
                                    : `Distribute to ${validMembers.length} Member${validMembers.length > 1 ? 's' : ''}`
                        }
                    </button>
                )}
            </div>
        </div>
    )
}
