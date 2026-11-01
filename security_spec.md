# Security Specification & Threat Model

## 1. System Invariants
1. **Business Isolation**: Each business profile possesses a unique identifier and owner name.
2. **Credential Integrity**: Users and password/PIN salts and hashes are stored with bounded length and strictly typed roles (`WORKER` or `OWNER`).
3. **Product Pricing & Catalog**: Every product must have a strictly positive or zero numeric selling price and bounded title length.
4. **Physical Inventory Bounds**: Quantities on hand must be numeric.
5. **Shift Ledger Integrity**: Every shift must specify valid shift numbers, worker identifiers, status strings, and financial float values.
6. **Stock Addition Auditability**: Additions and corrections must reference a valid shiftId and productId.
7. **Expense Accountability**: Logged expenses must include amounts, payment methods, and descriptions.
8. **Discrepancy Investigation**: Shortages or overages must document numeric variance and item identities.
9. **Event Log Immutability**: Historical audit events cannot be deleted.

## 2. The Dirty Dozen Threat Payloads
1. **ID Injection Attack**: Document ID with 2KB payload or malicious URL chars. *Result: REJECTED by isValidId().*
2. **Missing Required Fields**: Attempting to create a user without a `role` or `username`. *Result: REJECTED by schema guard.*
3. **Role Elevation Attack**: Attempting to set `role: "SUPER_ADMIN"`. *Result: REJECTED by allowed role list check.*
4. **Negative Price Tampering**: Selling price set as string `"FREE"`. *Result: REJECTED by incoming().sellingPrice is number.*
5. **Inventory Overflow / Poisoning**: Injecting 500KB text into inventory quantity. *Result: REJECTED by incoming().quantityOnHand is number.*
6. **Orphan Shift Items**: Line items missing shiftId or productId. *Result: REJECTED by schema check.*
7. **Negative Shift Status**: Blank or oversized shift status string. *Result: REJECTED.*
8. **Business Name Erasure**: Creating business with empty name. *Result: REJECTED by name.size() > 0.*
9. **Event Log Deletion**: Attempting to delete an audit trail event. *Result: REJECTED by allow delete: if false.*
10. **Business Deletion Attack**: Attempting to drop an active business doc. *Result: REJECTED by allow delete: if false.*
11. **Random Collection Injection**: Attempting write to an unauthorized root path like `/passwords` or `/backdoor`. *Result: REJECTED by default deny match /{document=**} { allow read, write: if false; }.*
12. **Null Type Bypass**: Passing null or undefined as mandatory ID. *Result: REJECTED by isValidId().*
