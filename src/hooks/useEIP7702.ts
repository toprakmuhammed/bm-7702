import { useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseAbi, parseEther, parseUnits, isAddress } from 'viem'
import { monadTestnet } from '../config/wagmi'

// BatchCallDelegation ABI (the contract EOA delegates to)
const BATCH_ABI = parseAbi([
    'struct Call { address to; uint256 value; bytes data; }',
    'function execute((address to, uint256 value, bytes data)[] calls)',
])

// ERC-20 ABI
const ERC20_ABI = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
])

export interface BatchCall {
    to: `0x${string}`
    value: bigint
    data: `0x${string}`
}

export interface Recipient {
    address: string
    amount: string
}

// Deployed BatchCallDelegation contract address on Monad Testnet
export const BATCH_DELEGATION_ADDRESS = '0xC2490c748577e9ECB94d7519c3DfF0AAfb54858C' as `0x${string}`

export type TxStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error'

/**
 * Validate that all recipients have valid Ethereum addresses
 */
export function validateRecipients(recipients: Recipient[]): string | null {
    for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i]
        if (!r.address || !r.amount) continue
        if (!isAddress(r.address)) {
            return `Row ${i + 1}: Invalid address "${r.address.slice(0, 10)}..."`
        }
        const amount = parseFloat(r.amount)
        if (isNaN(amount) || amount <= 0) {
            return `Row ${i + 1}: Invalid amount "${r.amount}"`
        }
    }
    return null
}

export function useEIP7702() {
    const { address } = useAccount()
    const { data: walletClient } = useWalletClient()
    const publicClient = usePublicClient()

    const [txStatus, setTxStatus] = useState<TxStatus>('idle')
    const [txHash, setTxHash] = useState<string>()
    const [txError, setTxError] = useState<string>()

    const reset = useCallback(() => {
        setTxStatus('idle')
        setTxHash(undefined)
        setTxError(undefined)
    }, [])

    // Build batch calls for native MON transfers (uses parseEther for precision)
    const buildNativeCalls = useCallback((recipients: Recipient[]): BatchCall[] => {
        return recipients
            .filter(r => r.address && r.amount && parseFloat(r.amount) > 0)
            .map(r => ({
                to: r.address as `0x${string}`,
                value: parseEther(r.amount),
                data: '0x' as `0x${string}`,
            }))
    }, [])

    // Build batch calls for ERC-20 transfers
    const buildERC20Calls = useCallback((tokenAddress: string, recipients: Recipient[], decimals: number = 18): BatchCall[] => {
        return recipients
            .filter(r => r.address && r.amount && parseFloat(r.amount) > 0)
            .map(r => ({
                to: tokenAddress as `0x${string}`,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [
                        r.address as `0x${string}`,
                        parseUnits(r.amount, decimals),
                    ],
                }),
            }))
    }, [])

    // Read ERC-20 decimals from on-chain
    const readTokenDecimals = useCallback(async (tokenAddress: string): Promise<number> => {
        if (!publicClient) return 18
        try {
            const decimals = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
            })
            return Number(decimals)
        } catch {
            return 18 // default fallback
        }
    }, [publicClient])

    // Execute batch using EIP-7702
    const executeBatch = useCallback(async (calls: BatchCall[]) => {
        if (!walletClient || !address || !publicClient) {
            setTxError('Wallet not connected')
            setTxStatus('error')
            return
        }

        if (BATCH_DELEGATION_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setTxError('Contract not deployed yet. Deploy the contract and update the address.')
            setTxStatus('error')
            return
        }

        try {
            setTxStatus('signing')
            setTxError(undefined)

            // Calculate total native value
            const totalValue = calls.reduce((sum, c) => sum + c.value, 0n)

            // EIP-7702 Authorization: delegate EOA to BatchCallDelegation contract
            const authorization = await walletClient.signAuthorization({
                contractAddress: BATCH_DELEGATION_ADDRESS,
            })

            setTxStatus('pending')

            // Encode execute(calls) for the BatchCallDelegation contract
            const callData = encodeFunctionData({
                abi: BATCH_ABI,
                functionName: 'execute',
                args: [calls.map(c => ({ to: c.to, value: c.value, data: c.data }))],
            })

            // Send the EIP-7702 transaction
            // The tx goes TO the EOA itself (since it now has the delegation code)
            const hash = await walletClient.sendTransaction({
                to: address,
                data: callData,
                value: totalValue,
                authorizationList: [authorization],
                chain: monadTestnet,
            })

            setTxHash(hash)

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash })

            if (receipt.status === 'success') {
                setTxStatus('success')
            } else {
                setTxStatus('error')
                setTxError('Transaction reverted')
            }

            return hash
        } catch (err: unknown) {
            setTxStatus('error')
            const message = err instanceof Error ? err.message : 'Unknown error'
            setTxError(message.length > 200 ? message.slice(0, 200) + '...' : message)
            console.error('EIP-7702 batch execution error:', err)
        }
    }, [walletClient, address, publicClient])

    return {
        txStatus,
        txHash,
        txError,
        executeBatch,
        buildNativeCalls,
        buildERC20Calls,
        readTokenDecimals,
        validateRecipients: validateRecipients,
        reset,
        explorerUrl: monadTestnet.blockExplorers.default.url,
    }
}
