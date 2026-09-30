# Bar Operations Reconciliation & Profit System

A dual-actor operational system connecting on-the-ground Kenyan bar operations to remote owner oversight through strict transition-based stock accountability, cash/M-Pesa balance reconciliation, automated variance calculation, and instant discrepancy reporting.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following critical requirements and user operational rules are locked into the design:

- **Confirmed Decision 1 (M-Pesa Balance Delta Model)**: As specified, each branch has an assigned M-Pesa account. At shift start, the worker records the physical entry M-Pesa balance (e.g., KES 10,000). At shift close, the worker records the closing M-Pesa balance (e.g., KES 17,000). The system automatically calculates:
  $$\text{Net M-Pesa Received} = \text{Closing M-Pesa} - \text{Opening M-Pesa} = 17,000 - 10,000 = 7,000\text{ KES}$$
  $$\text{Total Gross Income} = \text{Cash Collected} + \text{Net M-Pesa Received}$$
  The system matches this total income against recorded stock sales to detect exact financial discrepancies (Cash/M-Pesa Shortage or Overage).
- **Confirmed Decision 2 (Data Layer)**: LocalStorage offline-first standalone engine with simulated network sync. Workers can record rapid operations offline in basement/outdoor counters without lag; records queue and auto-sync to the central store.
- **Confirmed Decision 3 (Owner Oversight & Real-Time Status)**: Live auto-updating event stream with instant discrepancy alerts whenever closing stock or financial totals deviate from expected values.
- **Confirmed Decision 4 (Role & Access Gateway)**: Passcode and PIN authentication screen (Worker PIN `1234` / Owner PIN `8888`), with one-tap quick-fill demo buttons for effortless testing.

---

## 1. Overview & Core Concept

### What It Does
The system mirrors what physically happens in the bar into reliable, non-falsifiable records and calculations for the Owner. The Worker only records physical reality (opening counts, stock additions, transfers, customer payments, cash/M-Pesa expenses, closing counts, opening and closing M-Pesa balances). The system automatically:
1. Calculates sales velocity and remaining stock.
2. Derives net M-Pesa revenue ($Closing - Opening$) and net cash.
3. Compares expected drink sales against actual income returned.
4. Identifies physical stock shortages/overages and money discrepancies.
5. Computes net shift profit (Gross Income minus Cost of Goods Sold and Approved Shift Expenses).
6. Dispatches real-time automated updates to the Owner's live stream.

### Target Audience / Persona
- **Worker (Bartender / Counter Staff)**: Fast, tactile mobile interface designed for dark, busy bar environments. Big touch targets ($\ge 48\text{px}$), rapid number inputs, and step-by-step verification gates that prevent skipping shift stages.
- **Owner (Remote Bar Manager / Proprietor)**: Live oversight dashboard displaying real-time branch performance, active shifts, automated discrepancy alerts, and shift profit/loss without requiring physical presence at the counter.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow 1: Shift Opening & Dual Verification
1. Worker enters PIN (`1234`).
2. Worker selects Branch and Counter location.
3. **Step 1 - Opening M-Pesa Account Balance**:
   - Worker checks the branch business phone/SIM/till and inputs the starting M-Pesa balance (e.g. `KES 10,000`).
   - Worker enters Opening Cash Float (e.g. `KES 3,000` change float).
4. **Step 2 - Physical Counter Stock Verification**:
   - System presents expected opening stock item-by-item (from previous shift closing or warehouse issues).
   - Worker physically counts counter stock on the shelf.
   - If match: Worker confirms verification.
   - If discrepancy: Worker records the physical count; system logs an `INITIAL_STOCK_INCONSISTENCY` event for the Owner before unlocking the active shift.
5. Shift transitions to `ACTIVE` state.

#### Flow 2: Active Shift Reality Recording
1. **+ Sale**: Fast counter entry:
   - Select product (Tusker, White Cap, Johnnie Walker shot, Guinness, etc.)
   - Tap quantity (`+1`, `+2`, `+5`, or manual keypad)
   - Method: `Cash` or `M-Pesa` (Till / Paybill / Pochi / Send Money) with optional customer transaction reference.
2. **+ Stock Addition**: Receive stock issued from Main Store/Storekeeper or delivery.
3. **+ Stock Transfer**: Send or receive stock to/from another counter (Terrace Bar, VIP Lounge) with pending/accepted confirmation.
4. **+ Shift Expense**: Payout from counter (Ice delivery, limes, breakages, cleaning) with payment source (`Cash` or `M-Pesa`) and receipt note.
5. All operations work seamlessly offline and show a live sync indicator.

#### Flow 3: Shift Closing, M-Pesa Reconciliation & Closure
1. Worker taps **"Transition to Closing"**.
2. **Step 1 - Closing Physical Stock Count**:
   - Worker physically counts every item on the counter shelf and enters actual remaining bottles/units.
3. **Step 2 - Cash & M-Pesa Balance Entry**:
   - Worker enters ending Cash in Drawer (e.g., `KES 14,500`).
   - Worker checks business M-Pesa and enters **Closing M-Pesa Balance** (e.g., `KES 17,000`).
4. **Step 3 - Automatic Calculation & Discrepancy Generation**:
   - System automatically performs:
     $$\text{Net M-Pesa Income} = 17,000 - 10,000 = 7,000\text{ KES}$$
     $$\text{Net Cash Generated} = \text{Actual Cash in Drawer} - \text{Opening Cash Float} = 14,500 - 3,000 = 11,500\text{ KES}$$
     $$\text{Total Actual Income Surrendered} = 11,500 + 7,000 = 18,500\text{ KES}$$
     $$\text{Expected Stock Sales Revenue} = \sum (\text{Expected Units Sold} \times \text{Selling Price})$$
     $$\text{Expected Closing Stock} = \text{Opening} + \text{Additions} - \text{Sales} \pm \text{Transfers}$$
     $$\text{Stock Discrepancy} = \text{Physical Closing Count} - \text{Expected Closing Stock}$$
     $$\text{Financial Discrepancy} = (\text{Total Actual Income} + \text{Expenses}) - \text{Expected Stock Sales Revenue}$$
5. System displays the complete Reconciliation Card. Worker submits closure.
6. Real-time alert is triggered directly to the Owner's dashboard.

#### Flow 4: Owner Real-Time Command & Audit
1. Owner logs in with PIN (`8888`).
2. **Live Auto-Updating Event Stream**: Instant real-time feed showing shift opens, individual sales velocity, expense deductions, and shift completions.
3. **Automated Discrepancy Radar**: High-priority alert cards detailing any stock shortages (e.g. `2x Tusker Cider missing`) or cash/M-Pesa shortfalls with exact monetary values.
4. **Shift Financial Summary**:
   - Breakdown of Cash vs. M-Pesa balance delta.
   - Cost of Goods Sold (COGS).
   - Expenses deducted.
   - True Gross and Net Shift Profit.
5. **Auditing & Management**: Filter by branch, worker, date; adjust product catalog and unit costs; export clean reconciliation records.

### Visual Identity & Theme
- **Style**: Dark slate bar-grade industrial interface (`#0B0F17` background, `#151C28` cards, `#222F44` borders).
- **Brand Accents**: Safaricom M-Pesa Emerald Green (`#00A859` / `#10B981`) for positive money balances, verified steps, and confirmations; Crimson (`#EF4444`) for shortages; Amber (`#F59E0B`) for warnings.
- **Typography**: Clean `Plus Jakarta Sans` for titles, `Satoshi` for body text, and strict monospace tabular figures (`font-mono tabular-nums`) for currency amounts, stock counts, and timestamps.
- **Mobile Ergonomics**: Full-width $48\text{px}$ touch buttons in the natural thumb zone; aggregate sticky height strictly under 15% of viewport height.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Entry & Exit M-Pesa Balances**:
  - *Chosen Approach*: Worker inputs Opening M-Pesa Balance and Closing M-Pesa Balance. Net M-Pesa income is derived as $\text{Closing} - \text{Opening}$.
  - *Why*: Perfectly mirrors real Kenyan bar operations where staff check the till balance at handover rather than reconciling hundreds of individual SMS messages during peak rush hours.
- **Decision 2: Dual Reconciliation (Stock Discrepancy + Financial Discrepancy)**:
  - *Chosen Approach*: The system reconciles both physical stock (bottles counted vs. bottles expected) and money (cash + M-Pesa delta vs. theoretical sales revenue).
  - *Why*: Distinguishes whether a shortfall is due to unpaid drinks (physical stock gone, no cash/M-Pesa) or cash drawer shortage (all drinks paid, money missing).
- **Decision 3: Offline-First LocalStorage Engine with Reactive Event Bus**:
  - *Chosen Approach*: All transactions and shifts persist immediately to local storage with simulated network sync and instant event propagation to the Owner's live view.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION GATEWAY                           │
│              [PIN Screen: Worker PIN (1234) / Owner PIN (8888)]          │
└─────────────────────┬───────────────────────────────┬────────────────────┘
                      │                               │
        [Role: Worker]▼                               ▼[Role: Owner]
┌─────────────────────────────────┐   ┌────────────────────────────────────┐
│      WORKER MOBILE TERMINAL     │   │      OWNER EXECUTIVE COMMAND       │
│  - Opening M-Pesa & Cash Float  │   │  - Live Real-Time Event Stream     │
│  - Opening Stock Count & Verify │   │  - Real-Time Discrepancy Alerts    │
│  - Active Sales & Fast Counter  │   │  - M-Pesa vs Cash Breakdowns       │
│  - Shift Expenses & Transfers   │   │  - Gross & Net Profit Auditing     │
│  - Closing Physical Inventory   │   │  - Branch & Worker Accountability  │
│  - Closing M-Pesa & Cash Count  │   │  - Product Catalog & Cost Control  │
└────────────────┬────────────────┘   └────────────────┬───────────────────┘
                 │                                     │
                 ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   OPERATIONAL REALITY STORE & ENGINE                     │
│  - M-Pesa Delta Engine: Net M-Pesa = Closing - Opening                   │
│  - Cash Float Deductions & Gross Income Summation                        │
│  - Expected vs Physical Stock Reconciliation Formula                     │
│  - Discrepancy Detector (Stock Shortages & Monetary Shortages)           │
│  - Real-Time Event Bus (Auto-Updating Ticker & Status Broadcasts)        │
│  - LocalStorage Persistent Data Layer (Prisma-Aligned Entities)          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Entities

1. **Shift**:
   - `id`, `branchId`, `workerId`, `locationId`, `status` (`OPENING`, `ACTIVE`, `CLOSING`, `CLOSED`)
   - `openedAt`, `closedAt`
   - `openingCashFloat`: KES cash given for change (e.g. 3,000)
   - `openingMpesaBalance`: Starting balance on business M-Pesa phone (e.g. 10,000)
   - `closingCashActual`: Actual physical cash counted at end (e.g. 14,500)
   - `closingMpesaBalance`: Actual M-Pesa balance on phone at end (e.g. 17,000)
   - `calculatedMpesaIncome`: `closingMpesaBalance - openingMpesaBalance` (e.g. 7,000)
   - `calculatedCashIncome`: `closingCashActual - openingCashFloat` (e.g. 11,500)
   - `totalIncomeReturned`: `calculatedCashIncome + calculatedMpesaIncome` (e.g. 18,500)
   - `expectedSalesRevenue`: Calculated total from drinks sold
   - `totalExpenses`: Expenses paid during shift
   - `grossProfit`: `expectedSalesRevenue - totalCostOfGoodsSold`
   - `netProfit`: `grossProfit - totalExpenses`
   - `financialVariance`: `(totalIncomeReturned + totalExpenses) - expectedSalesRevenue`
2. **ShiftStockItem**:
   - `shiftId`, `productId`, `openingPhysicalCount`, `additions`, `recordedSales`, `transfersOut`, `transfersIn`, `closingPhysicalCount`, `expectedClosingCount`, `discrepancyCount`, `discrepancyValue`
3. **MpesaAccount**:
   - `id`, `branchId`, `accountName`, `accountType` (`BUY_GOODS_TILL`, `PAYBILL`, `POCHI_LA_BIASHARA`, `SEND_MONEY`), `identifier` (Till/Phone/Paybill number), `currentBalance`
4. **Expense**:
   - `id`, `shiftId`, `category`, `amount`, `paymentMethod` (`CASH` | `MPESA`), `description`, `timestamp`
5. **Discrepancy**:
   - `id`, `shiftId`, `type` (`STOCK_SHORTAGE`, `STOCK_OVERAGE`, `FINANCIAL_SHORTAGE`, `FINANCIAL_OVERAGE`), `details`, `amount`, `resolved`, `createdAt`

---

## 5. Verification & Testing Strategy

1. **Opening M-Pesa Balance & Stock Count Invariant**:
   - Validate shift cannot open without entering starting M-Pesa balance and confirming opening stock verification.
2. **Active Shift Transactions**:
   - Record sales, additions, and expenses; verify inventory and transaction logs update deterministically.
3. **Closing M-Pesa Delta Calculation**:
   - Test shift closing with Opening M-Pesa = 10,000 and Closing M-Pesa = 17,000.
   - Verify system automatically calculates Net M-Pesa = 7,000.
   - Verify total income returned = Net M-Pesa (7,000) + Net Cash.
4. **Discrepancy Detection & Real-Time Alerting**:
   - Simulate a physical stock count that is 2 bottles short of expected.
   - Verify immediate crimson discrepancy card on the Owner's live stream with bottle count and monetary value.
