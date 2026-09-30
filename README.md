# Bar Track — Bar Operations Reconciliation & Profit System

A dual-actor operational system connecting on-the-ground Kenyan bar operations to remote owner oversight through strict transition gates, physical stock accountability, cash/M-Pesa balance tracking, automated calculations, and real-time discrepancy alerts.

---

## Key Features

1. **Strict Non-Bypassable Shift Lifecycle**:
   - **Opening Shift**: Enter entry M-Pesa business balance (e.g. KES 10,000) & cash float (e.g. KES 3,000), physically count counter stock, verify or log inconsistency.
   - **Active Shift**: Rapid sale logging for Cash & M-Pesa (Buy Goods Till, Paybill, Pochi la Biashara, Send Money), restocks from warehouse, inter-station transfers, and authorized operational expenses.
   - **Closing Shift**: Physical ending count of bottles, ending cash drawer, ending M-Pesa balance (e.g. KES 17,000).
2. **Automated M-Pesa & Cash Math**:
   - Net M-Pesa Income = `Closing M-Pesa - Opening M-Pesa` (e.g., KES 17,000 - 10,000 = 7,000)
   - Net Cash Income = `Ending Cash - Opening Float` (e.g., KES 14,500 - 3,000 = 11,500)
   - Total Gross Income = Net Cash + Net M-Pesa (KES 18,500)
   - Automatic Discrepancy & Variance calculation against expected drink sales
   - Cost of Goods Sold (COGS), Gross Profit, and Net Profit after shift expenses
3. **Real-Time Executive Oversight**:
   - Live auto-updating event stream
   - High-priority Discrepancy Radar
   - Shift Ledgers & Reconciliation Archives
   - Real-time stock audit across counters and central store
   - Product catalog & wholesale cost management
4. **Security & Offline Resilience**:
   - PIN Authentication (Worker PIN `1234`, Owner PIN `8888`)
   - Offline-first LocalStorage engine with automatic synchronization

---

## Local Development in VS Code

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Dev Server
```bash
npm run dev
```

The app will be running at `http://localhost:3000`.

### 3. Push to GitHub
```bash
git init
git add .
git commit -m "feat: initial commit of Bar Track system"
git branch -M main
git remote add origin https://github.com/kennedy-labs/<YOUR_REPO_NAME>.git
git push -u origin main
```
