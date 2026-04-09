// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BillOfExchange
 * @notice Magnito's fourth trade finance instrument
 * @dev A digital negotiable instrument aligned with ITFA DNI initiative and UNCITRAL MLETR
 * A Bill of Exchange is a written order from a drawer to a drawee to pay a specific
 * amount to a payee on a specific date. Under MLETR it becomes a legally enforceable
 * digital negotiable instrument that can be transferred, accepted, and discounted.
 */
contract BillOfExchange {

    // The possible states of a Bill of Exchange
    enum Status { 
        Issued,       // Created by drawer, awaiting acceptance
        Accepted,     // Drawee has accepted the payment obligation
        Transferred,  // Transferred to a new payee
        Discounted,   // Sold to a financier at a discount for early payment
        Settled,      // Payment has been made
        Dishonoured,  // Payment was refused
        Cancelled     // Cancelled before acceptance
    }

    // The data structure of a single Bill of Exchange
    struct BOEData {
        uint256 id;
        address drawer;       // The seller — issues the bill and orders payment
        address drawee;       // The buyer — ordered to pay
        address payee;        // Who receives payment (initially the drawer)
        address financier;    // The discounting bank (if discounted)
        uint256 amount;
        string currency;
        uint256 maturityDate; // Unix timestamp — when payment is due
        string documentHash;  // Hash of the underlying trade document
        string billReference; // Reference number of the bill
        Status status;
    }

    // Storage for all bills of exchange
    mapping(uint256 => BOEData) public bills;
    uint256 public billCount;

    // Events recorded on the blockchain
    event BOEIssued(uint256 id, address drawer, address drawee, address payee, uint256 amount, uint256 maturityDate);
    event BOEAccepted(uint256 id, address drawee);
    event BOETransferred(uint256 id, address from, address to);
    event BOEDiscounted(uint256 id, address payee, address financier, uint256 amount);
    event BOESettled(uint256 id);
    event BOEDishonoured(uint256 id);
    event BOECancelled(uint256 id);

    /**
     * @notice Issue a new Bill of Exchange
     * @param _drawee The buyer ordered to pay
     * @param _payee Who receives payment (usually the drawer initially)
     * @param _amount The face value of the bill
     * @param _currency The currency of payment (e.g. "USD")
     * @param _maturityDate Unix timestamp when payment is due
     * @param _documentHash Hash of the underlying trade document
     * @param _billReference Reference number of the bill
     */
    function issueBOE(
        address _drawee,
        address _payee,
        uint256 _amount,
        string memory _currency,
        uint256 _maturityDate,
        string memory _documentHash,
        string memory _billReference
    ) public returns (uint256) {
        require(_amount > 0, "Amount must be greater than zero");
        require(_maturityDate > block.timestamp, "Maturity date must be in the future");
        require(_drawee != address(0), "Invalid drawee address");
        require(_payee != address(0), "Invalid payee address");

        billCount++;

        bills[billCount] = BOEData({
            id: billCount,
            drawer: msg.sender,
            drawee: _drawee,
            payee: _payee,
            financier: address(0),
            amount: _amount,
            currency: _currency,
            maturityDate: _maturityDate,
            documentHash: _documentHash,
            billReference: _billReference,
            status: Status.Issued
        });

        emit BOEIssued(billCount, msg.sender, _drawee, _payee, _amount, _maturityDate);
        return billCount;
    }

    /**
     * @notice Drawee accepts the payment obligation
     * @param _id The ID of the bill to accept
     */
    function acceptBOE(uint256 _id) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(bill.status == Status.Issued, "Bill is not in issued state");
        require(msg.sender == bill.drawee, "Only the drawee can accept");

        bill.status = Status.Accepted;
        emit BOEAccepted(_id, msg.sender);
    }

    /**
     * @notice Transfer the bill to a new payee
     * @param _id The ID of the bill to transfer
     * @param _newPayee The address of the new payee
     */
    function transferBOE(uint256 _id, address _newPayee) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(
            bill.status == Status.Accepted || bill.status == Status.Transferred,
            "Bill must be accepted or transferred to transfer again"
        );
        require(msg.sender == bill.payee, "Only the current payee can transfer");
        require(_newPayee != address(0), "Invalid new payee address");
        require(_newPayee != bill.payee, "Cannot transfer to the same payee");

        address previousPayee = bill.payee;
        bill.payee = _newPayee;
        bill.status = Status.Transferred;
        emit BOETransferred(_id, previousPayee, _newPayee);
    }

    /**
     * @notice Discount the bill — sell to a financier for early payment
     * @param _id The ID of the bill to discount
     * @param _financier The address of the discounting bank or financier
     */
    function discountBOE(uint256 _id, address _financier) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(
            bill.status == Status.Accepted || bill.status == Status.Transferred,
            "Bill must be accepted to be discounted"
        );
        require(msg.sender == bill.payee, "Only the current payee can discount");
        require(_financier != address(0), "Invalid financier address");

        address previousPayee = bill.payee;
        bill.payee = _financier;
        bill.financier = _financier;
        bill.status = Status.Discounted;
        emit BOEDiscounted(_id, previousPayee, _financier, bill.amount);
    }

    /**
     * @notice Settle the bill — payment has been made
     * @param _id The ID of the bill to settle
     */
    function settleBOE(uint256 _id) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(
            bill.status == Status.Accepted ||
            bill.status == Status.Transferred ||
            bill.status == Status.Discounted,
            "Bill cannot be settled in current state"
        );
        require(msg.sender == bill.drawee, "Only the drawee can settle");

        bill.status = Status.Settled;
        emit BOESettled(_id);
    }

    /**
     * @notice Dishonour the bill — drawee refuses to pay
     * @param _id The ID of the bill to dishonour
     */
    function dishonourBOE(uint256 _id) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(
            bill.status == Status.Accepted ||
            bill.status == Status.Transferred ||
            bill.status == Status.Discounted,
            "Bill cannot be dishonoured in current state"
        );
        require(msg.sender == bill.drawee, "Only the drawee can dishonour");

        bill.status = Status.Dishonoured;
        emit BOEDishonoured(_id);
    }

    /**
     * @notice Cancel the bill before it is accepted
     * @param _id The ID of the bill to cancel
     */
    function cancelBOE(uint256 _id) public {
        BOEData storage bill = bills[_id];
        require(bill.id != 0, "Bill does not exist");
        require(bill.status == Status.Issued, "Only issued bills can be cancelled");
        require(msg.sender == bill.drawer, "Only the drawer can cancel");

        bill.status = Status.Cancelled;
        emit BOECancelled(_id);
    }

    /**
     * @notice Get the details of a bill
     * @param _id The ID of the bill to retrieve
     */
    function getBOE(uint256 _id) public view returns (BOEData memory) {
        require(bills[_id].id != 0, "Bill does not exist");
        return bills[_id];
    }

    /**
     * @notice Check if a bill has reached its maturity date
     * @param _id The ID of the bill to check
     */
    function isMatured(uint256 _id) public view returns (bool) {
        require(bills[_id].id != 0, "Bill does not exist");
        return block.timestamp >= bills[_id].maturityDate;
    }
}