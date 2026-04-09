// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Invoice
 * @notice Magnito's first trade finance instrument
 * @dev Represents a tokenized trade invoice on the blockchain
 */
contract Invoice {

    // The possible states of an invoice
    enum Status { Pending, Paid, Cancelled, Locked }

    // The data structure of a single invoice
    struct InvoiceData {
        uint256 id;
        address seller;
        address buyer;
        uint256 amount;
        string documentHash;
        Status status;
    }

    // Storage for all invoices
    mapping(uint256 => InvoiceData) public invoices;
    uint256 public invoiceCount;

    // Events that get recorded on the blockchain
    event InvoiceCreated(uint256 id, address seller, address buyer, uint256 amount);
event InvoicePaid(uint256 id, address buyer);
event InvoiceCancelled(uint256 id);
event InvoiceLocked(uint256 id);
event InvoiceUnlocked(uint256 id);

    /**
     * @notice Create a new trade invoice
     * @param _buyer The address of the buyer
     * @param _amount The value of the invoice
     * @param _documentHash A hash of the invoice document for verification
     */
    function createInvoice(
        address _buyer,
        uint256 _amount,
        string memory _documentHash
    ) public returns (uint256) {
        invoiceCount++;

        invoices[invoiceCount] = InvoiceData({
            id: invoiceCount,
            seller: msg.sender,
            buyer: _buyer,
            amount: _amount,
            documentHash: _documentHash,
            status: Status.Pending
        });

        emit InvoiceCreated(invoiceCount, msg.sender, _buyer, _amount);
        return invoiceCount;
    }

    /**
     * @notice Mark an invoice as paid
     * @param _id The ID of the invoice to mark as paid
     */
    function payInvoice(uint256 _id) public {
        InvoiceData storage invoice = invoices[_id];
        require(invoice.id != 0, "Invoice does not exist");
        require(invoice.status == Status.Pending, "Invoice is not pending or is locked");
        require(msg.sender == invoice.buyer, "Only the buyer can pay");

        invoice.status = Status.Paid;
        emit InvoicePaid(_id, msg.sender);
    }

    /**
     * @notice Cancel a pending invoice
     * @param _id The ID of the invoice to cancel
     */
    function cancelInvoice(uint256 _id) public {
        InvoiceData storage invoice = invoices[_id];
        require(invoice.id != 0, "Invoice does not exist");
        require(invoice.status == Status.Pending, "Invoice is not pending or is locked");
       require(msg.sender == invoice.seller, "Only the seller can cancel");

        invoice.status = Status.Cancelled;
        emit InvoiceCancelled(_id);
    }

    /**
     * @notice Lock an invoice before bridging to XRPL

       /**
     * @notice Lock an invoice before bridging to XRPL
     * @param _id The ID of the invoice to lock
     */
    function lockInvoice(uint256 _id) public {
        InvoiceData storage invoice = invoices[_id];
        require(invoice.id != 0, "Invoice does not exist");
        require(invoice.status == Status.Pending, "Invoice is not pending");
        require(msg.sender == invoice.seller, "Only the seller can lock");

        invoice.status = Status.Locked;
        emit InvoiceLocked(_id);
    }

    /**
     * @notice Unlock an invoice if the bridge fails
     * @param _id The ID of the invoice to unlock
     */
    function unlockInvoice(uint256 _id) public {
        InvoiceData storage invoice = invoices[_id];
        require(invoice.id != 0, "Invoice does not exist");
        require(invoice.status == Status.Locked, "Invoice is not locked");
        require(msg.sender == invoice.seller, "Only the seller can unlock");

        invoice.status = Status.Pending;
        emit InvoiceUnlocked(_id);
    }
    /**
     * @notice Get the details of an invoice
     * @param _id The ID of the invoice to retrieve
     */
    function getInvoice(uint256 _id) public view returns (InvoiceData memory) {
        require(invoices[_id].id != 0, "Invoice does not exist");
        return invoices[_id];
    }
}