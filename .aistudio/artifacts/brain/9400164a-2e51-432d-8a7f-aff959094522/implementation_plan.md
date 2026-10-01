# Inter-Business Bar Network & Stock Transfers

A simple, non-technical way for independent bar businesses to link together, dispatch stock loans (beer, spirits, soft drinks), and accept incoming inventory with a single tap, with automated cost adjustments and mutual ledger tracking.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural decisions below directly incorporate your confirmed choices:

- **Confirmed Decision 1 (Connection)**: Bars connect using a simple **6-digit Bar Connect Code** (e.g. `BAR-482`) or the bar's **registered phone number**. No complex API keys, logins, or tech setup required.
- **Confirmed Decision 2 (Financial / Cost Accounting)**: When a transfer is accepted, the inventory cost of the product (`quantity * costPrice`) is **automatically removed from the giving bar** and **added to the receiving bar's cost baseline**. In the shift ledger, it is recorded under `transfersOut` and `transfersIn` so neither bartender is flagged for a shortage or surplus.
- **Confirmed Decision 3 (Verification & Acceptance)**: The receiving bartender receives a **prominent 1-tap notification card** directly on their active shift screen with two big buttons: `[✓ Accept & Add to Bar]` and `[✗ Reject]`. Once accepted, bottles immediately enter the bar's active stock.

---

## 1. Overview & Core Concept

In nightlife and hospitality, neighboring bars frequently "borrow" and "lend" crates of beer or spirits during peak hours when a supplier delivery is delayed or demand surges. For non-technical bar attendants and owners, this is currently tracked on scrap paper or informal WhatsApp chats, leading to lost inventory, disputed debts, and broken shift reconciliations.

This feature enables two standalone bars to:
1. **Pair in Seconds**: Bar A enters Bar B’s 6-digit connect code or phone number once to establish a trusted partner link.
2. **Dispatch Stock in 2 Taps**: Select the partner bar, choose the drink from the A–Z list, enter the quantity, and tap "Dispatch to Partner".
3. **Accept with 1 Tap**: The receiving bar's live terminal immediately shows the transfer. Tapping "Accept" adds the physical bottles into their active shift inventory and transfers the cost value seamlessly.
4. **Mutual Partner Ledger**: Both owners can view an automated summary of who owes what (e.g., *"The Copper Kettle owes us 2 crates of Tusker (KES 9,120)"*), with 1-tap options to return stock or settle in cash/M-Pesa.

---

## 2. User Experience & Visual Design

### A. Non-Technical Workflow Walkthrough

```
[BAR A: DISPATCHING]
Active Shift Screen ──► Tap "Inter-Bar Transfer" ──► Select Partner Bar (e.g. Copper Kettle)
                                                 ──► Pick Drink & Qty (e.g. 24x Tusker Lager)
                                                 ──► Tap "Dispatch Stock" (Stock is held in-transit)

[BAR B: RECEIVING]
Active Shift Screen ──► Prominent Notification Card Pops Up
                        "Incoming: 24x Tusker Lager 500ml from Bar A (Value: KES 4,560)"
                        ──► Tap "[✓ Accept & Add to Bar]"
                        ──► Stock instantly added to Bar B inventory & shift count
                        ──► Cost KES 4,560 transferred from Bar A to Bar B
```

### B. Visual Elements & UI Placement

1. **Partner Bars Tab & Connect Modal (Owner & Worker Navigation)**:
   - Header shows the bar's own **6-digit Connect Code** (e.g. `Code: 739-204`) with a quick copy button.
   - "Connect New Bar" input accepts a 6-digit code or M-Pesa phone number.
   - List of connected partner bars showing name, owner contact, and current net stock loan balance.

2. **Dispatch Stock Modal (Worker Terminal)**:
   - Accessible via a clean action button: `"🔄 Send Stock to Partner Bar"`.
   - Single-column drink picker with real-time stock availability indicators so workers cannot dispatch more than what they have on hand.
   - Shows both bottle count and total cost value transferred.

3. **Incoming Stock Banner (Active Shift Screen)**:
   - High-contrast alert card pinned to the top of the bartender's terminal when a transfer is pending.
   - Clear details: Sender Bar Name, Attendant Name, Drink Name, Bottles Count, and Cost Value.
   - Big, tactile touch targets: `[✓ Accept & Add to Stock]` (Emerald) and `[✗ Decline]` (Slate/Red).

4. **Inter-Bar Partner Ledger (Owner Dashboard)**:
   - Summary card per partner bar:
     - Total bottles lent vs. total bottles borrowed.
     - Net financial cost balance (e.g. `+ KES 9,120 Receivable` or `- KES 4,560 Payable`).
     - Itemized history of all dispatched and accepted deliveries.

5. **Multi-Business Simulation Switcher (Dev / Preview Convenience)**:
   - A clean top switcher in preview mode allowing the user to seamlessly toggle between **"Bar 1 (The Alchemist Bar)"** and **"Bar 2 (The Copper Kettle Lounge)"** to test dispatching and 1-tap receiving live on one device without logging out.

---

## 3. Key Product Decisions & Trade-Offs

- **Cost Valuation Transfer (`costPrice * quantity`)**:
  - *Chosen Approach*: When Bar A sends 24 bottles of Tusker to Bar B, Bar A's stock asset decreases by KES 4,560 (24 * KES 190) and Bar B's inventory asset increases by KES 4,560.
  - *Why*: Both bars can accurately calculate Gross Profit and Cost of Goods Sold without distorting retail margins or flagging attendants for missing stock.
- **1-Tap Attendant Acceptance**:
  - *Chosen Approach*: Bartenders on duty can accept stock directly without waiting for owner PIN codes.
  - *Why*: During a rush at 11 PM, bartenders need the bottles immediately. Full traceability is preserved through the attendant’s name and shift ID.
- **Standalone Business Integrity**:
  - *Chosen Approach*: Each bar remains completely independent with its own database, shifts, staff, and pricing. Connecting bars does not merge accounts or expose private daily sales or profit data.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BAR A (STANDALONE)                            │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   Active Shift        │              │   Inventory State         │  │
│  │   transfersOut: +24   │              │   quantityOnHand: -24     │  │
│  │   COGS Balance: -4,560│              │   Cost Value: -KES 4,560  │  │
│  └───────────┬───────────┘              └─────────────▲─────────────┘  │
│              │ Dispatch Event                         │                │
└──────────────┼────────────────────────────────────────┼────────────────┘
               │                                        │
               ▼                                        │
┌───────────────────────────────────────────────────────┴────────────────┐
│               INTER-BUSINESS NETWORK BROKER (Store Service)            │
│  • Business Registry: { id, name, code, phone, balance }               │
│  • Transfer Queue: PENDING ──► ACCEPTED / REJECTED                     │
│  • Mutual Cost Ledger: Debits Giver / Credits Receiver                 │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼ 1-Tap Accept
┌────────────────────────────────────────────────────────────────────────┐
│                          BAR B (STANDALONE)                            │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   Active Shift        │              │   Inventory State         │  │
│  │   transfersIn: +24    │              │   quantityOnHand: +24     │  │
│  │   COGS Balance: +4,560│              │   Cost Value: +KES 4,560  │  │
│  └───────────────────────┘              └───────────────────────────┘  │
│  Incoming Notification Banner: [✓ Accept] [✗ Decline]                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Additions

```typescript
export interface BusinessProfile {
  id: string;
  name: string;
  connectCode: string; // 6 digits, e.g. "849201"
  phone: string;       // e.g. "0722123456"
  ownerName: string;
}

export interface BusinessPartner {
  id: string;
  businessId: string;
  partnerBusinessId: string;
  partnerName: string;
  partnerPhone: string;
  netCostBalance: number; // Positive = they owe us; Negative = we owe them
  connectedAt: string;
}

export interface InterBusinessTransfer {
  id: string;
  fromBusinessId: string;
  fromBusinessName: string;
  fromShiftId: string;
  senderWorkerName: string;

  toBusinessId: string;
  toBusinessName: string;
  toShiftId?: string;
  receiverWorkerName?: string;

  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;     // KES cost per unit transferred
  totalCostValue: number; // quantity * unitCost

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  dispatchedAt: string;
  acceptedAt?: string;
  notes?: string;
}
```

### Implementation Phases

1. **Phase 1: Store & Data Layer**:
   - Add `BusinessProfile`, `BusinessPartner`, and `InterBusinessTransfer` entities to `src/types/index.ts`.
   - Update `store.ts` with methods to:
     - Pair a partner bar via 6-digit code or phone number.
     - Dispatch an inter-business transfer (deduct stock on hand, record `transfersOut`).
     - Accept an incoming transfer (increment receiver stock on hand, record `transfersIn`, transfer cost valuation).
     - Provide a simple business context switcher for testing Bar A vs Bar B.
2. **Phase 2: Worker Terminal UX**:
   - Add an **Incoming Transfer Notification Banner** on the active shift screen with 1-tap `[Accept]` and `[Decline]` actions.
   - Add a simple **"Send Stock to Partner Bar"** modal.
3. **Phase 3: Owner Dashboard & Partner Ledger**:
   - Add a **"Partner Bars & Stock Loans"** tab in Owner Dashboard to view connected bars, enter 6-digit connect codes, and view the mutual bottle and KES cost ledger.
4. **Phase 4: Verification & Git Commit**:
   - Validate full TypeScript types, linting, build verification, and push to GitHub.
