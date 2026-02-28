import { useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseAbi, parseEther, parseUnits, isAddress, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
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
    const { data: walletClient, error: walletClientError } = useWalletClient()
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
            setTxError(`Connection missing - wallet: ${!!walletClient} (err: ${walletClientError?.message || 'none'}), addr: ${!!address}, pub: ${!!publicClient}`)
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

            // Explicitly fetch the execution nonce to ensure authorization is valid BEFORE signing
            const currentNonce = await publicClient.getTransactionCount({ address: address as `0x${string}` })

            // EIP-7702 Authorization: delegate EOA to BatchCallDelegation contract
            let authorization;
            let finalWalletClient: any = walletClient;

            try {
                // Try from injected wallet first
                authorization = await walletClient.signAuthorization({
                    contractAddress: BATCH_DELEGATION_ADDRESS,
                    nonce: currentNonce + 1,
                })
            } catch (err: any) {
                const errMsg = err.message || '';
                // If it's the known viem json-rpc error, fallback to VITE_PRIVATE_KEY
                if (errMsg.includes('json-rpc') || errMsg.includes('not supported')) {
                    const pkStr = import.meta.env.VITE_PRIVATE_KEY
                    if (pkStr && pkStr.startsWith('0x')) {
                        const account = privateKeyToAccount(pkStr as `0x${string}`)

                        if (account.address.toLowerCase() !== address.toLowerCase()) {
                            throw new Error(`Fallback PK address (${account.address.slice(0, 6)}...) does not match connected address (${address.slice(0, 6)}...). Switch Metamask to the correct account!`)
                        }

                        // Create a temporary Local Account Wallet Client to sign offline
                        const tempWalletClient = createWalletClient({
                            account,
                            chain: monadTestnet,
                            transport: http(monadTestnet.rpcUrls.default.http[0])
                        })

                        authorization = await tempWalletClient.signAuthorization({
                            contractAddress: BATCH_DELEGATION_ADDRESS,
                            nonce: currentNonce + 1,
                        })
                        finalWalletClient = tempWalletClient;
                    } else {
                        throw new Error(`Wallet doesn't support EIP-7702 yet. Please add VITE_PRIVATE_KEY=... in .env to enable the offline fallback!`)
                    }
                } else {
                    throw err; // Other user rejections etc.
                }
            }

            setTxStatus('pending')

            // Encode execute(calls) for the BatchCallDelegation contract
            const callData = encodeFunctionData({
                abi: BATCH_ABI,
                functionName: 'execute',
                args: [calls.map(c => ({ to: c.to, value: c.value, data: c.data }))],
            })

            // Metamask and other JSON-RPC wallets currently DO NOT support EIP-7702 (Transaction Type 4).
            // If we send through them, they silently drop the "authorizationList" and format it as a normal Type 2 transaction.
            // Therefore, we MUST use the local 'finalWalletClient' if we are in fallback mode.
            if (finalWalletClient !== walletClient) {
                // Since Wallets won't show a popup, we show a native browser confirmation instead
                const proceed = window.confirm(`Kullandığınız Cüzdan (Metamask, Rabby vb.) henüz EIP-7702 standardını desteklememektedir.\n\nBu nedenle işlem geçici olarak .env dosyanızdaki VITE_PRIVATE_KEY kullanılarak arka planda imzalanacaktır.\nToplam Tutar: ${Number(totalValue) / 1e18} MON\n\nİşlemi onaylayıp dağıtımı başlatmak istiyor musunuz?`);
                if (!proceed) {
                    setTxStatus('idle');
                    setTxError('İşlem kullanıcı tarafından iptal edildi.');
                    return;
                }
            }

            // Send the EIP-7702 transaction (Type 4)
            // The tx goes TO the EOA itself (since it now has the delegation code)
            const hash = await finalWalletClient.sendTransaction({
                to: address as `0x${string}`,
                data: callData,
                value: totalValue,
                authorizationList: [authorization],
                chain: monadTestnet,
                type: 'eip7702', // Force Type 4 transaction format
                account: finalWalletClient.account || address,
                nonce: currentNonce, // Ensure tx nonce and auth nonce match
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
    }, [walletClient, address, publicClient, walletClientError])

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
