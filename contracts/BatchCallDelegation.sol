// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title BatchCallDelegation
 * @notice EIP-7702 delegation target contract for batch token distribution.
 *         An EOA signs an authorization to temporarily adopt this contract's code,
 *         enabling batch execution of multiple transfers in a single transaction.
 *
 * @dev Usage flow:
 *   1. EOA signs EIP-7702 authorization pointing to this contract
 *   2. Transaction includes authorizationList + call to execute(calls)
 *   3. All calls execute atomically in the EOA's context
 *   4. Delegation ends after transaction
 */
contract BatchCallDelegation {

    /// @notice Represents a single call within a batch
    struct Call {
        address to;     // Target address
        uint256 value;  // Native token amount (MON)
        bytes data;     // Calldata (empty for native transfers, encoded for ERC-20)
    }

    /// @notice Nonce to prevent replay attacks on sponsored executions
    uint256 public nonce;

    /// @notice Emitted when a batch of calls is executed
    event BatchExecuted(address indexed sender, uint256 callCount, uint256 nonce);

    /// @notice Emitted for each individual call in the batch
    event CallExecuted(
        uint256 indexed index,
        address indexed to,
        uint256 value,
        bool success
    );

    /// @notice Emitted when a sponsored batch is executed
    event SponsoredBatchExecuted(
        address indexed authority,
        address indexed sponsor,
        uint256 callCount,
        uint256 nonce
    );

    // ─── Self-execution ─────────────────────────────────────────────

    /**
     * @notice Execute a batch of calls. Called directly by the EOA
     *         that has delegated to this contract via EIP-7702.
     * @param calls Array of Call structs to execute sequentially
     */
    function execute(Call[] calldata calls) external payable {
        // In EIP-7702 context, msg.sender == the EOA itself (since the
        // EOA's code IS this contract). We verify address(this) == msg.sender
        // to ensure only the delegating EOA can call execute.
        require(msg.sender == address(this), "BatchCallDelegation: unauthorized");

        uint256 currentNonce = nonce;
        nonce = currentNonce + 1;

        _executeBatch(calls);

        emit BatchExecuted(msg.sender, calls.length, currentNonce);
    }

    // ─── Sponsored execution ────────────────────────────────────────

    /**
     * @notice Execute a batch of calls on behalf of the EOA, submitted
     *         by a third-party sponsor/relayer. Requires off-chain signature.
     * @param calls Array of Call structs to execute
     * @param signature EIP-712 signature from the EOA authorizing this batch
     */
    function execute(
        Call[] calldata calls,
        bytes calldata signature
    ) external payable {
        uint256 currentNonce = nonce;

        // Build the digest for signature verification
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(
                    address(this),
                    block.chainid,
                    currentNonce,
                    calls
                ))
            )
        );

        // Recover signer
        address signer = _recover(digest, signature);
        require(signer == address(this), "BatchCallDelegation: invalid signature");

        nonce = currentNonce + 1;

        _executeBatch(calls);

        emit SponsoredBatchExecuted(signer, msg.sender, calls.length, currentNonce);
    }

    // ─── Internal ───────────────────────────────────────────────────

    /**
     * @dev Execute all calls in the batch. Reverts if any call fails.
     */
    function _executeBatch(Call[] calldata calls) internal {
        uint256 len = calls.length;
        for (uint256 i = 0; i < len; ) {
            Call calldata c = calls[i];
            (bool success, ) = c.to.call{value: c.value}(c.data);
            require(success, "BatchCallDelegation: call reverted");

            emit CallExecuted(i, c.to, c.value, success);

            unchecked { ++i; }
        }
    }

    /**
     * @dev Recover the signer from an ECDSA signature.
     */
    function _recover(
        bytes32 digest,
        bytes calldata signature
    ) internal pure returns (address) {
        require(signature.length == 65, "BatchCallDelegation: invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "BatchCallDelegation: invalid v value");

        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0), "BatchCallDelegation: invalid signature");
        return recovered;
    }

    /// @notice Allow contract to receive native tokens
    receive() external payable {}
}
