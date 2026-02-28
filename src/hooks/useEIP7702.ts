import { useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseAbi } from 'viem'
import { monadTestnet } from '../config/wagmi'

// BatchCallDelegation ABI (the contract EOA delegates to)
const BATCH_ABI = parseAbi([
    'struct Call { address to; uint256 value; bytes data; }',
    'function execute((address to, uint256 value, bytes data)[] calls)',
])

// ERC-20 transfer ABI
const ERC20_ABI = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
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
// This will be updated after deployment
export const BATCH_DELEGATION_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

export type TxStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error'

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

    // Build batch calls for native MON transfers
    const buildNativeCalls = useCallback((recipients: Recipient[]): BatchCall[] => {
        return recipients
            .filter(r => r.address && r.amount)
            .map(r => ({
                to: r.address as `0x${string}`,
                value: BigInt(Math.floor(parseFloat(r.amount) * 1e18)),
                data: '0x' as `0x${string}`,
            }))
    }, [])

    // Build batch calls for ERC-20 transfers
    const buildERC20Calls = useCallback((tokenAddress: string, recipients: Recipient[]): BatchCall[] => {
        return recipients
            .filter(r => r.address && r.amount)
            .map(r => ({
                to: tokenAddress as `0x${string}`,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [
                        r.address as `0x${string}`,
                        BigInt(Math.floor(parseFloat(r.amount) * 1e18)),
                    ],
                }),
            }))
    }, [])

    // Execute batch using EIP-7702
    // In a real EIP-7702 flow:
    // 1. Sign authorization to delegate EOA to BatchCallDelegation contract
    // 2. Send tx with authorizationList + call execute(calls[])
    const executeBatch = useCallback(async (calls: BatchCall[]) => {
        if (!walletClient || !address || !publicClient) {
            setTxError('Wallet not connected')
            setTxStatus('error')
            return
        }

        try {
            setTxStatus('signing')
            setTxError(undefined)

            // Calculate total native value
            const totalValue = calls.reduce((sum, c) => sum + c.value, 0n)

            // EIP-7702 Authorization: delegate EOA to BatchCallDelegation contract
            // The walletClient.signAuthorization is the experimental EIP-7702 action
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
        reset,
        explorerUrl: monadTestnet.blockExplorers.default.url,
    }
}
