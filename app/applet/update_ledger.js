const fs = require("fs");
const file = "src/components/worker/UnifiedStockLedger.tsx";
let content = fs.readFileSync(file, "utf8");

// 1. Add states
const targetState = '  // Minimal subtle form state for optional stock reduction note\n  const [reductionNoteProductId, setReductionNoteProductId] = useState<string | null>(null);\n  const [noteInputStrings, setNoteInputStrings] = useState<Record<string, string>>({});';

const replacementState = targetState + `

  // Expandable Stock Additions Ledger state
  const [expandedAddProductId, setExpandedAddProductId] = useState<string | null>(null);
  const [newAdditionType, setNewAdditionType] = useState<"ADD" | "REDUCE">("ADD");
  const [newAdditionQty, setNewAdditionQty] = useState<string>("");
  const [newAdditionReason, setNewAdditionReason] = useState<string>("");

  useBackHandler(Boolean(expandedAddProductId), () => setExpandedAddProductId(null), "worker-expanded-addition");`;

if (content.includes(targetState)) {
  content = content.replace(targetState, replacementState);
} else {
  console.log("Warning: targetState not found");
}

// 2. Add helper functions
const targetHelper = '  const handleSaveReductionNote = (productId: string, noteText: string) => {';
const replacementHelper = `  const handleRecordAdditionSlip = (productId: string) => {
    if (!activeShift) return;
    const qty = Number(newAdditionQty);
    if (!qty || qty <= 0) {
      showToast("Please enter a valid quantity greater than 0");
      return;
    }
    try {
      store.recordStockAdjustment({
        shiftId: activeShift.id,
        productId,
        quantity: qty,
        type: newAdditionType,
        reason: newAdditionReason.trim() || (newAdditionType === "ADD" ? "Restock / Delivery" : "Return / Adjustment"),
        workerName: currentUser.name || currentUser.username || "Attendant",
      });
      showToast(\`Recorded \${newAdditionType === "ADD" ? "+" : "-"}\${qty} for item\`);
      setNewAdditionQty("");
      setNewAdditionReason("");
    } catch (err: any) {
      showToast(err.message || "Error recording addition slip");
    }
  };

  const handleDeleteAdditionSlip = (additionId: string) => {
    try {
      store.deleteStockAddition(additionId, true);
      showToast("Removed stock slip");
    } catch (err: any) {
      showToast(err.message || "Error deleting slip");
    }
  };

  const handleSaveReductionNote = (productId: string, noteText: string) => {`;

if (content.includes(targetHelper)) {
  content = content.replace(targetHelper, replacementHelper);
} else {
  console.log("Warning: targetHelper not found");
}

// 3. Replace Add cell input with trigger button
const targetCell = `                        {/* 3. Add Stock Input */}
                        <td
                          className={\`py-2.5 px-1.5 sm:px-2 text-center transition-colors \${row.addedStock < 0 ? 'bg-rose-950/20' : row.addedStock > 0 ? 'bg-emerald-950/15' : ''}\`}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onContextMenu={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={cellInputStrings[p.id]?.added !== undefined ? cellInputStrings[p.id]?.added : (row.addedStock !== undefined && row.addedStock !== 0 ? String(row.addedStock) : '')}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleCellBlur(p.id, 'added')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^-?\\d*\\.?\\d*$/.test(val)) {
                                handleCellChange(p.id, 'added', val);
                              }
                            }}
                            onMouseDown={(e) => {
                                const timer = setTimeout(() => {
                                    setAdjustmentModes(prev => ({
                                        ...prev,
                                        [p.id]: prev[p.id] === 'SUBTRACT' ? 'ADD' : 'SUBTRACT'
                                    }));
                                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                        navigator.vibrate?.(40);
                                    }
                                }, 500);
                                (e.target as any)._pressTimer = timer;
                            }}
                            onMouseUp={(e) => clearTimeout((e.target as any)._pressTimer)}
                            onMouseLeave={(e) => clearTimeout((e.target as any)._pressTimer)}
                            placeholder="0"
                            title="Tap to add, long press to toggle add/subtract mode"
                            className={\`w-15 sm:w-18 text-center py-2 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none transition-colors \${
                              (adjustmentModes[p.id] || 'ADD') === 'SUBTRACT'
                                ? 'border-rose-600/70 text-rose-300 bg-rose-950/30 focus:border-rose-500'
                                : 'border-emerald-600/70 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500'
                            }\`}
                          />
                          {/* If stock is reduced (< 0), show subtle trigger button for optional note */}
                          {row.addedStock < 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReductionNoteProductId(reductionNoteProductId === p.id ? null : p.id);
                              }}
                              className={\`mt-1 text-[10px] sm:text-[11px] font-sans flex items-center justify-center gap-1 mx-auto px-1.5 py-0.5 rounded transition-all max-w-[90px] cursor-pointer \${
                                row.adjustmentNote
                                  ? 'text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/50'
                                  : 'text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40'
                              }\`}
                              title={row.adjustmentNote ? \`Reason: \${row.adjustmentNote}\` : 'Add note for reduction'}
                            >
                              <FileText className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">
                                {row.adjustmentNote ? row.adjustmentNote : '+ note'}
                              </span>
                            </button>
                          )}
                        </td>`;

const replacementCell = `                        {/* 3. Add Stock Input & Delivery Slips Trigger */}
                        <td
                          className={\`py-2.5 px-1.5 sm:px-2 text-center transition-colors \${row.addedStock < 0 ? 'bg-rose-950/20' : row.addedStock > 0 ? 'bg-emerald-950/15' : ''}\`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAddProductId(expandedAddProductId === p.id ? null : p.id);
                              setNewAdditionQty("");
                              setNewAdditionReason("");
                              setNewAdditionType("ADD");
                            }}
                            className={\`w-full py-2 px-2 rounded-lg border font-mono text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer \${
                              row.addedStock > 0
                                ? 'bg-emerald-950/30 border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/40'
                                : row.addedStock < 0
                                ? 'bg-rose-950/30 border-rose-600/70 text-rose-300 hover:bg-rose-900/40'
                                : 'bg-[#0D1117] border-slate-800 text-slate-300 hover:border-emerald-600/50 hover:bg-emerald-950/10'
                            }\`}
                            title="Tap to record multiple additions or returns"
                          >
                            {row.addedStock !== 0 ? (
                              <span>{row.addedStock > 0 ? \`+\${row.addedStock}\` : row.addedStock}</span>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Add</span>
                              </>
                            )}
                            {productSlips.length > 1 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-sans">
                                {productSlips.length}
                              </span>
                            )}
                          </button>
                          {/* If stock is reduced (< 0), show subtle trigger button for optional note */}
                          {row.addedStock < 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReductionNoteProductId(reductionNoteProductId === p.id ? null : p.id);
                              }}
                              className={\`mt-1 text-[10px] sm:text-[11px] font-sans flex items-center justify-center gap-1 mx-auto px-1.5 py-0.5 rounded transition-all max-w-[90px] cursor-pointer \${
                                row.adjustmentNote
                                  ? 'text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/50'
                                  : 'text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40'
                              }\`}
                              title={row.adjustmentNote ? \`Reason: \${row.adjustmentNote}\` : 'Add note for reduction'}
                            >
                              <FileText className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">
                                {row.adjustmentNote ? row.adjustmentNote : '+ note'}
                              </span>
                            </button>
                          )}
                        </td>`;

if (content.includes(targetCell)) {
  content = content.replace(targetCell, replacementCell);
} else {
  console.log("Warning: targetCell not found");
}

// 4. Insert expandable sub-row after row closing </tr>
const specificTargetRowEnd = `                        </td>
                      </tr>

                      {/* Minimal subtle form for optional note when stock is reduced */}`;

const specificReplacementRowEnd = `                        </td>
                      </tr>

                      {/* Expandable Stock Additions Ledger & Quick Recorder */}
                      {expandedAddProductId === p.id && (
                        <tr key={\`\${p.id}-additions-ledger\`} className="bg-[#090E17] border-b-2 border-emerald-500/50 animate-in fade-in duration-150">
                          <td colSpan={7} className="p-3 sm:p-5 font-sans">
                            <div className="bg-[#111726] border border-[#1E2638] rounded-xl p-3 sm:p-4 space-y-4 shadow-lg">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-emerald-400" />
                                  <span className="text-xs sm:text-sm font-bold text-slate-100">
                                    Stock Delivery Slips & Adjustments — {p.name}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedAddProductId(null)}
                                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer p-1"
                                >
                                  <X className="w-4 h-4" /> Close
                                </button>
                              </div>

                              {/* Quick Recorder Form */}
                              <div className="bg-[#090D14] p-3 rounded-lg border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setNewAdditionType("ADD")}
                                    className={\`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer \${
                                      newAdditionType === "ADD"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                                    }\`}
                                  >
                                    + Add / Restock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNewAdditionType("REDUCE")}
                                    className={\`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer \${
                                      newAdditionType === "REDUCE"
                                        ? "bg-rose-600 text-white shadow-sm"
                                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                                    }\`}
                                  >
                                    - Reduce / Return
                                  </button>
                                </div>

                                {/* Preset Quantity Buttons */}
                                <div className="flex flex-wrap gap-1.5">
                                  {[1, 2, 5, 10, 24].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setNewAdditionQty(String(n))}
                                      className={\`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer \${
                                        newAdditionQty === String(n)
                                          ? "bg-sky-600 text-white"
                                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                                      }\`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setNewAdditionQty("")}
                                    className="px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    min="0.1"
                                    value={newAdditionQty}
                                    onChange={(e) => setNewAdditionQty(e.target.value)}
                                    placeholder="Qty (e.g. 10)"
                                    className="w-full sm:w-28 bg-[#111726] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                                  />
                                  <input
                                    type="text"
                                    value={newAdditionReason}
                                    onChange={(e) => setNewAdditionReason(e.target.value)}
                                    placeholder="Note / Reason (e.g. Supplier delivery, Wine bar return...)"
                                    className="flex-1 bg-[#111726] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRecordAdditionSlip(p.id)}
                                    className={\`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer shadow-sm \${
                                      newAdditionType === "ADD"
                                        ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
                                        : "bg-rose-600 hover:bg-rose-500 active:bg-rose-700"
                                    }\`}
                                  >
                                    Save Slip
                                  </button>
                                </div>
                              </div>

                              {/* Slips History Timeline */}
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                  Recorded Delivery Slips ({productSlips.length})
                                </div>
                                {productSlips.length === 0 ? (
                                  <div className="text-xs text-slate-500 italic py-2 text-center bg-[#090D14] rounded-lg border border-slate-800/60">
                                    No delivery slips recorded for this item in this shift yet. Tap + Add or choose quantity above.
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {productSlips.map((slip) => {
                                      const isPos = Number(slip.quantity) > 0;
                                      return (
                                        <div
                                          key={slip.id}
                                          className={\`flex items-center justify-between p-2 rounded-lg border text-xs font-mono \${
                                            isPos
                                              ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-300"
                                              : "bg-rose-950/20 border-rose-900/50 text-rose-300"
                                          }\`}
                                        >
                                          <div className="flex items-center gap-2.5 truncate">
                                            <span className={\`font-bold px-1.5 py-0.5 rounded text-[11px] \${isPos ? "bg-emerald-900/40 text-emerald-200" : "bg-rose-900/40 text-rose-200"}\`}>
                                              {isPos ? \`+\${slip.quantity}\` : slip.quantity}
                                            </span>
                                            <div className="flex flex-col truncate font-sans text-slate-300 text-[11px]">
                                              <span className="truncate">{slip.reason || (isPos ? "Restock" : "Reduction")}</span>
                                              <span className="text-[9px] text-slate-500">
                                                {new Date(slip.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {slip.workerName ? \`• \${slip.workerName}\` : ""}
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAdditionSlip(slip.id)}
                                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 ml-2"
                                            title="Delete delivery slip"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Minimal subtle form for optional note when stock is reduced */}`;

if (content.includes(specificTargetRowEnd)) {
  content = content.replace(specificTargetRowEnd, specificReplacementRowEnd);
  fs.writeFileSync(file, content, "utf8");
  console.log("Successfully updated UnifiedStockLedger.tsx!");
} else {
  console.log("Warning: specificTargetRowEnd not found");
}
