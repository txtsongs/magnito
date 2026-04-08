// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BillOfLading
 * @notice Magnito's Electronic Bill of Lading (eBL) contract
 * @dev Represents legal title to goods in transit on the blockchain
 *      Compliant with UNCITRAL MLETR principles:
 *      - Singularity: one authoritative holder at any time
 *      - Control: only the holder can transfer
 *      - Integrity: document hash anchored on-chain
 */
contract BillOfLading {

    // The possible states of an eBL
    enum Status { Active, Pledged, Surrendered }

    // The data structure of a single eBL
    struct EBLData {
        uint256 id;
        address carrier;        // issued by the shipping company
        address holder;         // current lawful holder (title owner)
        address pledgee;        // bank holding as collateral (if pledged)
        string documentHash;    // digital fingerprint of the eBL document
        string vesselName;      // name of the ship
        string portOfLoading;   // where goods were loaded
        string portOfDischarge; // where goods will be delivered
        string goodsDescription;// what is being shipped
        Status status;
    }

    // Storage for all eBLs
    mapping(uint256 => EBLData) public ebls;
    uint256 public eblCount;

    // Events recorded permanently on the blockchain
    event EBLIssued(
        uint256 id,
        address carrier,
        address holder,
        string documentHash
    );
    event EBLTransferred(
        uint256 id,
        address from,
        address to
    );
    event EBLPledged(
        uint256 id,
        address holder,
        address pledgee
    );
    event EBLUnpledged(
        uint256 id,
        address pledgee,
        address holder
    );
    event EBLSurrendered(
        uint256 id,
        address holder
    );

    // ─────────────────────────────────────────
    // ISSUE
    // ─────────────────────────────────────────

    /**
     * @notice Carrier issues a new eBL when goods are loaded
     * @param _holder The initial lawful holder (usually the shipper/exporter)
     * @param _documentHash Digital fingerprint of the eBL document
     * @param _vesselName Name of the vessel carrying the goods
     * @param _portOfLoading Port where goods were loaded
     * @param _portOfDischarge Port where goods will be delivered
     * @param _goodsDescription Description of the cargo
     */
    function issueEBL(
        address _holder,
        string memory _documentHash,
        string memory _vesselName,
        string memory _portOfLoading,
        string memory _portOfDischarge,
        string memory _goodsDescription
    ) public returns (uint256) {
        eblCount++;

        ebls[eblCount] = EBLData({
            id: eblCount,
            carrier: msg.sender,
            holder: _holder,
            pledgee: address(0),
            documentHash: _documentHash,
            vesselName: _vesselName,
            portOfLoading: _portOfLoading,
            portOfDischarge: _portOfDischarge,
            goodsDescription: _goodsDescription,
            status: Status.Active
        });

        emit EBLIssued(eblCount, msg.sender, _holder, _documentHash);
        return eblCount;
    }

    // ─────────────────────────────────────────
    // TRANSFER
    // ─────────────────────────────────────────

    /**
     * @notice Transfer the eBL to a new holder
     * @dev Only the current holder can transfer
     *      Cannot transfer while pledged
     * @param _id The ID of the eBL to transfer
     * @param _newHolder The address of the new lawful holder
     */
    function transferEBL(uint256 _id, address _newHolder) public {
        EBLData storage ebl = ebls[_id];

        require(ebl.id != 0, "eBL does not exist");
        require(ebl.status == Status.Active, "eBL is not active");
        require(msg.sender == ebl.holder, "Only the holder can transfer");
        require(_newHolder != address(0), "Invalid new holder address");
        require(_newHolder != ebl.holder, "Already the holder");

        address previousHolder = ebl.holder;
        ebl.holder = _newHolder;

        emit EBLTransferred(_id, previousHolder, _newHolder);
    }

    // ─────────────────────────────────────────
    // PLEDGE
    // ─────────────────────────────────────────

    /**
     * @notice Pledge the eBL as collateral to a bank
     * @dev Only the current holder can pledge
     *      Blocks transfers while pledged - MLETR singularity
     * @param _id The ID of the eBL to pledge
     * @param _pledgee The bank or financier receiving the pledge
     */
    function pledgeEBL(uint256 _id, address _pledgee) public {
        EBLData storage ebl = ebls[_id];

        require(ebl.id != 0, "eBL does not exist");
        require(ebl.status == Status.Active, "eBL is not active");
        require(msg.sender == ebl.holder, "Only the holder can pledge");
        require(_pledgee != address(0), "Invalid pledgee address");

        ebl.pledgee = _pledgee;
        ebl.status = Status.Pledged;

        emit EBLPledged(_id, ebl.holder, _pledgee);
    }

    // ─────────────────────────────────────────
    // UNPLEDGE
    // ─────────────────────────────────────────

    /**
     * @notice Release the eBL from pledge back to the holder
     * @dev Only the pledgee bank can unpledge
     * @param _id The ID of the eBL to unpledge
     */
    function unpledgeEBL(uint256 _id) public {
        EBLData storage ebl = ebls[_id];

        require(ebl.id != 0, "eBL does not exist");
        require(ebl.status == Status.Pledged, "eBL is not pledged");
        require(msg.sender == ebl.pledgee, "Only the pledgee can unpledge");

        address previousPledgee = ebl.pledgee;
        ebl.pledgee = address(0);
        ebl.status = Status.Active;

        emit EBLUnpledged(_id, previousPledgee, ebl.holder);
    }

    // ─────────────────────────────────────────
    // SURRENDER
    // ─────────────────────────────────────────

    /**
     * @notice Surrender the eBL when goods are delivered
     * @dev Only the current holder can surrender
     *      Terminal state - cannot be reversed
     * @param _id The ID of the eBL to surrender
     */
    function surrenderEBL(uint256 _id) public {
        EBLData storage ebl = ebls[_id];

        require(ebl.id != 0, "eBL does not exist");
        require(ebl.status == Status.Active, "eBL must be active to surrender");
        require(msg.sender == ebl.holder, "Only the holder can surrender");

        ebl.status = Status.Surrendered;

        emit EBLSurrendered(_id, msg.sender);
    }

    // ─────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────

    /**
     * @notice Get the full details of an eBL
     * @param _id The ID of the eBL to retrieve
     */
    function getEBL(uint256 _id) public view returns (EBLData memory) {
        require(ebls[_id].id != 0, "eBL does not exist");
        return ebls[_id];
    }

    /**
     * @notice Check if an address is the current holder of an eBL
     * @param _id The eBL ID
     * @param _address The address to check
     */
    function isHolder(uint256 _id, address _address) public view returns (bool) {
        return ebls[_id].holder == _address;
    }
}