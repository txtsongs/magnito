// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IInstrument
 * @notice Standard bridge-facing interface every Magnito instrument implements.
 * @dev Domain logic (payment, transfer, presentation, acceptance, discounting,
 *      settlement, etc.) stays bespoke per instrument. This interface is only
 *      the seam the bridge orchestrator and chain adapters use to move an
 *      instrument across chains without knowing its specific type.
 *
 *      Lifecycle: lock() freezes an instrument in preparation for a bridge
 *      (2PC prepare phase) and is reversible via unlock() if the bridge
 *      aborts. markBridged() is called only after a successful commit and is
 *      terminal — once bridged, an instrument can never again be paid,
 *      transferred, pledged, accepted, discounted, settled, or cancelled on
 *      its origin chain.
 */
interface IInstrument {
    /// @notice The instrument's bridge lifecycle state, collapsed from whatever
    /// domain-specific enum the implementing contract actually uses. Every
    /// instrument's own "live" states (Invoice's Pending/Paid/Cancelled, eBL's
    /// Active/Pledged/Surrendered, LC's and BoE's own multi-state workflows)
    /// all map to Live — the bridge only ever needs to distinguish whether an
    /// instrument is free, mid-bridge, or terminally bridged, never which of
    /// its own domain states it's in.
    enum BridgeState { Live, Locked, Bridged }

    /// @notice Freeze an instrument in preparation for a cross-chain bridge (2PC prepare phase)
    function lock(uint256 id) external;

    /// @notice Reverse a lock if the bridge aborts — returns the instrument to its pre-lock state
    function unlock(uint256 id) external;

    /// @notice Finalize a bridge (2PC commit phase). Terminal — irreversible.
    function markBridged(uint256 id) external;

    /// @notice Whether the instrument has reached the terminal Bridged state
    function isBridged(uint256 id) external view returns (bool);

    /// @notice The instrument's current bridge lifecycle state (Live/Locked/Bridged)
    function bridgeState(uint256 id) external view returns (BridgeState);
}
