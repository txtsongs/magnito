// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title LetterOfCredit
 * @notice Magnito's Letter of Credit (LC) contract
 * @dev Implements electronic LC workflows aligned with ICC UCP 600 and eUCP v2.1
 *      - Presentation deadline enforcement
 *      - 5 banking day examination window
 *      - Discrepancy handling
 *      - Accept / Refuse flows
 */
contract LetterOfCredit {

    // The possible states of an LC
    enum Status { 
        Open,           // LC is active and awaiting presentation
        Presented,      // Documents have been presented
        Discrepancy,    // Bank has flagged a problem
        Accepted,       // Bank has accepted documents - payment due
        Refused,        // Bank has refused the presentation
        Expired         // LC has expired without presentation
    }

    // The data structure of a single LC
    struct LCData {
        uint256 id;
        address issuingBank;        // bank that created the LC
        address applicant;          // importer / buyer
        address beneficiary;        // exporter / seller
        uint256 amount;             // value of the LC
        string currency;            // e.g. "USD", "EUR"
        string documentHash;        // hash of the LC document
        string requiredDocuments;   // description of required docs
        uint256 presentationDeadline; // unix timestamp - last day to present
        uint256 examinationDeadline;  // unix timestamp - 5 banking days after presentation
        string[] presentedDocHashes;  // hashes of presented documents
        string discrepancyReason;   // reason if discrepancy flagged
        Status status;
    }

    // Storage for all LCs
    mapping(uint256 => LCData) public lcs;
    uint256 public lcCount;

    // Events recorded permanently on the blockchain
    event LCOpened(
        uint256 id,
        address issuingBank,
        address applicant,
        address beneficiary,
        uint256 amount,
        string currency
    );
    event DocumentsPresented(
        uint256 id,
        address beneficiary,
        uint256 presentedAt
    );
    event DiscrepancyMarked(
        uint256 id,
        address issuingBank,
        string reason
    );
    event LCAccepted(
        uint256 id,
        address issuingBank
    );
    event LCRefused(
        uint256 id,
        address issuingBank,
        string reason
    );
    event LCExpired(
        uint256 id
    );

    // ─────────────────────────────────────────
    // OPEN
    // ─────────────────────────────────────────

    /**
     * @notice Issuing bank opens a new Letter of Credit
     * @param _applicant The importer / buyer
     * @param _beneficiary The exporter / seller
     * @param _amount The value of the LC
     * @param _currency The currency (e.g. "USD")
     * @param _documentHash Hash of the LC document
     * @param _requiredDocuments Description of documents required for presentation
     * @param _presentationDeadline Unix timestamp of the last day to present documents
     */
    function openLC(
        address _applicant,
        address _beneficiary,
        uint256 _amount,
        string memory _currency,
        string memory _documentHash,
        string memory _requiredDocuments,
        uint256 _presentationDeadline
    ) public returns (uint256) {
        require(_applicant != address(0), "Invalid applicant address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_amount > 0, "Amount must be greater than zero");
        require(_presentationDeadline > block.timestamp, "Deadline must be in the future");

        lcCount++;

        string[] memory emptyDocs;

        lcs[lcCount] = LCData({
            id: lcCount,
            issuingBank: msg.sender,
            applicant: _applicant,
            beneficiary: _beneficiary,
            amount: _amount,
            currency: _currency,
            documentHash: _documentHash,
            requiredDocuments: _requiredDocuments,
            presentationDeadline: _presentationDeadline,
            examinationDeadline: 0,
            presentedDocHashes: emptyDocs,
            discrepancyReason: "",
            status: Status.Open
        });

        emit LCOpened(lcCount, msg.sender, _applicant, _beneficiary, _amount, _currency);
        return lcCount;
    }

    // ─────────────────────────────────────────
    // PRESENT DOCUMENTS
    // ─────────────────────────────────────────

    /**
     * @notice Beneficiary presents documents for examination
     * @dev Aligned with eUCP v2.1 - electronic presentation
     *      Sets examination deadline to 5 days after presentation
     * @param _id The LC ID
     * @param _docHashes Array of document hashes being presented
     */
    function presentDocuments(
        uint256 _id,
        string[] memory _docHashes
    ) public {
        LCData storage lc = lcs[_id];

        require(lc.id != 0, "LC does not exist");
        require(lc.status == Status.Open, "LC is not open");
        require(msg.sender == lc.beneficiary, "Only the beneficiary can present");
        require(block.timestamp <= lc.presentationDeadline, "Presentation deadline has passed");
        require(_docHashes.length > 0, "Must present at least one document");

        lc.presentedDocHashes = _docHashes;
        // 5 days examination window (UCP 600 Article 14)
        lc.examinationDeadline = block.timestamp + 5 days;
        lc.status = Status.Presented;

        emit DocumentsPresented(_id, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────
    // MARK DISCREPANCY
    // ─────────────────────────────────────────

    /**
     * @notice Issuing bank flags a discrepancy in the presented documents
     * @dev Must be within the examination window (UCP 600 Article 14)
     * @param _id The LC ID
     * @param _reason Description of the discrepancy
     */
    function markDiscrepancy(
        uint256 _id,
        string memory _reason
    ) public {
        LCData storage lc = lcs[_id];

        require(lc.id != 0, "LC does not exist");
        require(lc.status == Status.Presented, "LC documents not yet presented");
        require(msg.sender == lc.issuingBank, "Only the issuing bank can mark discrepancy");
        require(block.timestamp <= lc.examinationDeadline, "Examination window has closed");
        require(bytes(_reason).length > 0, "Must provide a discrepancy reason");

        lc.discrepancyReason = _reason;
        lc.status = Status.Discrepancy;

        emit DiscrepancyMarked(_id, msg.sender, _reason);
    }

    // ─────────────────────────────────────────
    // ACCEPT
    // ─────────────────────────────────────────

    /**
     * @notice Issuing bank accepts the documents and honours the LC
     * @dev Payment obligation is triggered off-chain
     * @param _id The LC ID
     */
    function acceptLC(uint256 _id) public {
        LCData storage lc = lcs[_id];

        require(lc.id != 0, "LC does not exist");
        require(
            lc.status == Status.Presented || lc.status == Status.Discrepancy,
            "LC must be presented or discrepant"
        );
        require(msg.sender == lc.issuingBank, "Only the issuing bank can accept");
        require(block.timestamp <= lc.examinationDeadline, "Examination window has closed");

        lc.status = Status.Accepted;

        emit LCAccepted(_id, msg.sender);
    }

    // ─────────────────────────────────────────
    // REFUSE
    // ─────────────────────────────────────────

    /**
     * @notice Issuing bank refuses the presentation
     * @param _id The LC ID
     * @param _reason Reason for refusal
     */
    function refuseLC(uint256 _id, string memory _reason) public {
        LCData storage lc = lcs[_id];

        require(lc.id != 0, "LC does not exist");
        require(
            lc.status == Status.Presented || lc.status == Status.Discrepancy,
            "LC must be presented or discrepant"
        );
        require(msg.sender == lc.issuingBank, "Only the issuing bank can refuse");
        require(block.timestamp <= lc.examinationDeadline, "Examination window has closed");
        require(bytes(_reason).length > 0, "Must provide a refusal reason");

        lc.status = Status.Refused;

        emit LCRefused(_id, msg.sender, _reason);
    }

    // ─────────────────────────────────────────
    // EXPIRE
    // ─────────────────────────────────────────

    /**
     * @notice Mark an LC as expired if presentation deadline has passed
     * @dev Anyone can trigger expiry after the deadline
     * @param _id The LC ID
     */
    function expireLC(uint256 _id) public {
        LCData storage lc = lcs[_id];

        require(lc.id != 0, "LC does not exist");
        require(lc.status == Status.Open, "LC is not open");
        require(block.timestamp > lc.presentationDeadline, "Deadline has not passed yet");

        lc.status = Status.Expired;

        emit LCExpired(_id);
    }

    // ─────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────

    /**
     * @notice Get the full details of an LC
     * @param _id The LC ID
     */
    function getLC(uint256 _id) public view returns (LCData memory) {
        require(lcs[_id].id != 0, "LC does not exist");
        return lcs[_id];
    }

    /**
     * @notice Get the presented document hashes for an LC
     * @param _id The LC ID
     */
    function getPresentedDocs(uint256 _id) public view returns (string[] memory) {
        require(lcs[_id].id != 0, "LC does not exist");
        return lcs[_id].presentedDocHashes;
    }

    /**
     * @notice Check if an LC is still within its examination window
     * @param _id The LC ID
     */
    function isWithinExaminationWindow(uint256 _id) public view returns (bool) {
        LCData storage lc = lcs[_id];
        require(lc.id != 0, "LC does not exist");
        return lc.examinationDeadline > 0 && block.timestamp <= lc.examinationDeadline;
    }
}