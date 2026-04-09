/**
 * ISO 20022 Adapter
 * Generates ISO 20022 compliant message stubs from Magnito bridge events.
 * Banks and financial institutions communicate using ISO 20022 messaging.
 * These stubs demonstrate that Magnito is designed to speak that language.
 */

const fs = require("fs");
const path = require("path");

/**
 * Generate a pain.001 message stub — Customer Credit Transfer Initiation
 * Used when an invoice is created and payment is initiated
 */
function generatePain001(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MAGNITO-${data.invoiceId}-${Date.now()}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${data.amount}</CtrlSum>
      <InitgPty>
        <Nm>Magnito Bridge</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>MAGNITO-INV-${data.invoiceId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>
        <Dt>${new Date().toISOString().split("T")[0]}</Dt>
      </ReqdExctnDt>
      <Dbtr>
        <Nm>${data.buyer}</Nm>
      </Dbtr>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>MAGNITO-${data.invoiceId}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${data.currency}">${data.amount}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${data.seller}</Nm>
        </Cdtr>
        <RmtInf>
          <Ustrd>Invoice ${data.invoiceId} - ${data.documentHash}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

/**
 * Generate a camt.054 message stub — Bank to Customer Debit Credit Notification
 * Used when the bridge cycle completes and settlement is confirmed
 */
function generateCamt054(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
  <BkToCstmrDbtCdtNtfctn>
    <GrpHdr>
      <MsgId>MAGNITO-SETTLE-${data.invoiceId}-${Date.now()}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
    </GrpHdr>
    <Ntfctn>
      <Id>MAGNITO-${data.invoiceId}</Id>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <Ntry>
        <Amt Ccy="${data.currency}">${data.amount}</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>
          <Cd>BOOK</Cd>
        </Sts>
        <BookgDt>
          <Dt>${new Date().toISOString().split("T")[0]}</Dt>
        </BookgDt>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <EndToEndId>MAGNITO-${data.invoiceId}</EndToEndId>
            </Refs>
            <AddtlTxInf>EthereumTx:${data.lockTxHash} XRPLTx:${data.mintTxHash}</AddtlTxInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Ntfctn>
  </BkToCstmrDbtCdtNtfctn>
</Document>`;
}

/**
 * Save ISO 20022 messages to the iso20022/ folder
 */
function generateISO20022Messages(data) {
  const outputDir = path.join(__dirname, "..", "iso20022");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const pain001 = generatePain001(data);
  const camt054 = generateCamt054(data);

  const pain001File = `pain001-invoice-${data.invoiceId}-${Date.now()}.xml`;
  const camt054File = `camt054-settlement-${data.invoiceId}-${Date.now()}.xml`;

  fs.writeFileSync(path.join(outputDir, pain001File), pain001);
  fs.writeFileSync(path.join(outputDir, camt054File), camt054);

  return { pain001File, camt054File, outputDir };
}

module.exports = { generateISO20022Messages };