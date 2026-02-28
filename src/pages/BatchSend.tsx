import { useState, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useEIP7702, Recipient, validateRecipients } from '../hooks/useEIP7702'
import { TransactionStatus } from '../components/TransactionStatus'

export function BatchSend() {
    const { isConnected } = useAccount()
    const { txStatus, txHash, txError, executeBatch, buildNativeCalls, buildERC20Calls, readTokenDecimals, reset, explorerUrl } = useEIP7702()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [tokenType, setTokenType] = useState<'native' | 'erc20'>('native')
    const [tokenAddress, setTokenAddress] = useState('')
    const [recipients, setRecipients] = useState<Recipient[]>([
        { address: '', amount: '' },
        { address: '', amount: '' },
        { address: '', amount: '' },
    ])
    const [validationError, setValidationError] = useState<string>()
    const [csvInfo, setCsvInfo] = useState<string>()
    const [isDragging, setIsDragging] = useState(false)

    const addRow = () => {
        setRecipients(prev => [...prev, { address: '', amount: '' }])
    }

    const removeRow = (index: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== index))
    }

    const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
        setRecipients(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
        setValidationError(undefined)
    }

    const parseCSV = useCallback((text: string) => {
        const lines = text.split('\n').filter(l => l.trim())

        // Skip header row if it looks like one
        const firstLine = lines[0]?.toLowerCase() || ''
        const startIdx = (firstLine.includes('address') || firstLine.includes('wallet') || firstLine.includes('recipient'))
            ? 1
            : 0

        const parsed: Recipient[] = []
        const errors: string[] = []

        for (let i = startIdx; i < lines.length; i++) {
            const [address, amount] = lines[i].split(',').map(s => s.trim())
            if (!address) continue

            if (address && address.startsWith('0x') && address.length === 42) {
                parsed.push({ address, amount: amount || '' })
            } else {
                errors.push(`Line ${i + 1}: Invalid address`)
            }
        }

        if (parsed.length > 0) {
            setRecipients(parsed)
            setCsvInfo(`${parsed.length} recipients imported${errors.length > 0 ? `, ${errors.length} skipped` : ''}`)
            setTimeout(() => setCsvInfo(undefined), 4000)
        } else {
            setValidationError('No valid recipients found in CSV')
        }
    }, [])

    const handleCSVImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            parseCSV(text)
        }
        reader.readAsText(file)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [parseCSV])

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const file = e.dataTransfer.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            parseCSV(text)
        }
        reader.readAsText(file)
    }, [parseCSV])

    const validRecipients = recipients.filter(r => r.address && r.amount && parseFloat(r.amount) > 0)
    const totalAmount = validRecipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

    const handleSend = async () => {
        if (validRecipients.length === 0) return

        // Validate addresses
        const error = validateRecipients(validRecipients)
        if (error) {
            setValidationError(error)
            return
        }
        setValidationError(undefined)

        let calls
        if (tokenType === 'native') {
            calls = buildNativeCalls(validRecipients)
        } else {
            if (!tokenAddress) return
            const decimals = await readTokenDecimals(tokenAddress)
            calls = buildERC20Calls(tokenAddress, validRecipients, decimals)
        }

        await executeBatch(calls)
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-header__title">Batch Send</h1>
                <p className="page-header__desc">
                    Send tokens to multiple wallets in a single transaction. Add recipients manually or import from CSV.
                </p>
            </div>

            {/* Token Selection */}
            <div className="section">
                <div className="section__title">Token</div>
                <div className="card">
                    <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                        <div className="input-group" style={{ minWidth: '180px' }}>
                            <label className="input-label">Token Type</label>
                            <select
                                className="input"
                                value={tokenType}
                                onChange={(e) => setTokenType(e.target.value as 'native' | 'erc20')}
                            >
                                <option value="native">MON (Native)</option>
                                <option value="erc20">ERC-20 Token</option>
                            </select>
                        </div>
                        {tokenType === 'erc20' && (
                            <div className="input-group" style={{ flex: 1, minWidth: '300px' }}>
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
                    </div>
                </div>
            </div>

            {/* Summary Bar */}
            <div className="summary-bar">
                <div className="stat">
                    <span className="stat__label">Recipients</span>
                    <span className="stat__value stat__value--sm">{validRecipients.length}</span>
                </div>
                <div className="stat">
                    <span className="stat__label">Total Amount</span>
                    <span className="stat__value stat__value--sm">
                        {totalAmount.toFixed(4)} {tokenType === 'native' ? 'MON' : 'Tokens'}
                    </span>
                </div>
                <div className="stat">
                    <span className="stat__label">Transaction</span>
                    <span className="stat__value stat__value--sm">1</span>
                </div>
            </div>

            {/* Recipients Table */}
            <div className="section">
                <div className="section__title">Recipients</div>
                <div className="flex gap-sm mb-md">
                    <button className="btn btn--sm" onClick={addRow}>
                        + Add Row
                    </button>
                    <button className="btn btn--sm" onClick={() => fileInputRef.current?.click()}>
                        ↑ Import CSV
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCSVImport}
                        style={{ display: 'none' }}
                    />
                    {recipients.length > 1 && (
                        <button
                            className="btn btn--sm btn--danger"
                            onClick={() => {
                                setRecipients([{ address: '', amount: '' }])
                                setValidationError(undefined)
                                setCsvInfo(undefined)
                            }}
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {/* CSV Import Info */}
                {csvInfo && (
                    <div className="mb-md" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--success)' }}>
                        ✓ {csvInfo}
                    </div>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>Wallet Address</th>
                                <th style={{ width: '180px' }}>Amount</th>
                                <th style={{ width: '60px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipients.map((r, i) => (
                                <tr key={i} className="animate-row" style={{ animationDelay: `${i * 30}ms` }}>
                                    <td style={{ color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</td>
                                    <td>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder="0x..."
                                            value={r.address}
                                            onChange={(e) => updateRecipient(i, 'address', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder="0.0"
                                            value={r.amount}
                                            onChange={(e) => updateRecipient(i, 'amount', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        {recipients.length > 1 && (
                                            <button
                                                className="btn btn--sm btn--danger"
                                                onClick={() => removeRow(i)}
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
            </div>

            {/* CSV Drop Zone — with real drag-and-drop */}
            <div
                className={`drop-zone mb-lg ${isDragging ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="drop-zone__text">
                    {isDragging ? (
                        'Drop CSV file here'
                    ) : (
                        <>
                            Drop CSV file here or click to upload<br />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                Format: address,amount (one per line)
                            </span>
                        </>
                    )}
                </div>
            </div>

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

            {/* Send Button */}
            <div className="mt-lg flex gap-md">
                {txStatus === 'success' || txStatus === 'error' ? (
                    <button className="btn btn--primary btn--lg btn--full" onClick={reset}>
                        New Batch
                    </button>
                ) : (
                    <button
                        className={`btn btn--primary btn--lg btn--full ${txStatus !== 'idle' ? 'btn--loading' : ''}`}
                        onClick={handleSend}
                        disabled={!isConnected || validRecipients.length === 0 || txStatus !== 'idle'}
                    >
                        {!isConnected
                            ? 'Connect Wallet First'
                            : validRecipients.length === 0
                                ? 'Add Recipients'
                                : `Send to ${validRecipients.length} Wallet${validRecipients.length > 1 ? 's' : ''}`
                        }
                    </button>
                )}
            </div>
        </div>
    )
}
