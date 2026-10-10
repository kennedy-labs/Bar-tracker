import React, { useState, useEffect } from 'react';
import { store } from '../../services/store';
import { weightMeasurementService } from '../../services/weightMeasurement';
import { Product } from '../../types';
import { Scale, X, Check, Calculator, Info, RefreshCw } from 'lucide-react';

interface WeightCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  onApplyCount?: (productId: string, weightKg: number) => void;
}

export const WeightCalculatorModal: React.FC<WeightCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialProductId,
  onApplyCount,
}) => {
  const products = store.getProducts();
  const weightProducts = products.filter((p) => weightMeasurementService.isWeightMeasured(p));

  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || (weightProducts[0]?.id || 'custom'));
  const [tankName, setTankName] = useState<string>('Keg Draft Tank');
  const [fullWeightKg, setFullWeightKg] = useState<number>(60);
  const [tareWeightKg, setTareWeightKg] = useState<number>(0);
  const [pricePerKg, setPricePerKg] = useState<number>(150);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(31);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  useEffect(() => {
    if (selectedProductId !== 'custom') {
      const prod = products.find((p) => p.id === selectedProductId);
      if (prod) {
        setTankName(prod.name);
        setFullWeightKg(prod.fullWeightKg || 60);
        setTareWeightKg(prod.emptyWeightKg || 0);
        setPricePerKg(prod.pricePerKg || prod.sellingPrice || 150);
        const inv = store.getInventory().find((i) => i.productId === prod.id);
        if (inv && inv.quantityOnHand !== undefined) {
          setCurrentWeightKg(inv.quantityOnHand);
        }
      }
    }
  }, [selectedProductId, products]);

  if (!isOpen) return null;

  const result = weightMeasurementService.calculateValue(
    currentWeightKg,
    pricePerKg,
    tareWeightKg,
    fullWeightKg
  );

  const presets = weightMeasurementService.getStandardKegPresets();

  const handleApply = () => {
    if (selectedProductId !== 'custom') {
      if (onApplyCount) {
        onApplyCount(selectedProductId, currentWeightKg);
      } else {
        store.adjustProductStock(selectedProductId, currentWeightKg);
      }
      setAppliedMessage(`Applied ${currentWeightKg} kg (KES ${result.totalValueKes.toLocaleString()}) to ${tankName}`);
      setTimeout(() => {
        setAppliedMessage(null);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#121824] border border-cyan-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Weight Scale & Keg Valuation
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  Service Active
                </span>
              </div>
              <p className="text-[11px] text-cyan-300">
                Formula: Weight (kg) × Price per kg (KES) = Stock Value (KES)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {appliedMessage && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedMessage}</span>
          </div>
        )}

        {/* Product selector if registered items exist */}
        {weightProducts.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Select Keg / Weight Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {weightProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.fullWeightKg || 60}kg tank @ KES {p.pricePerKg || p.sellingPrice}/kg)
                </option>
              ))}
              <option value="custom">Custom Scale Calculator / Simulation</option>
            </select>
          </div>
        )}

        {/* Quick Presets */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Quick Standard Keg Presets</span>
            <span className="text-cyan-400 font-mono">East Africa Bar Standards</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {presets.slice(0, 3).map((pr) => (
              <button
                key={pr.name}
                type="button"
                onClick={() => {
                  setSelectedProductId('custom');
                  setTankName(pr.name);
                  setFullWeightKg(pr.fullWeightKg);
                  setTareWeightKg(pr.emptyWeightKg);
                  setPricePerKg(pr.pricePerKg);
                  setCurrentWeightKg(31);
                }}
                className="p-2 rounded-xl bg-[#0E1420] hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-600 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-white truncate">{pr.name}</div>
                <div className="text-[10px] text-cyan-300 font-mono">
                  {pr.fullWeightKg}kg · KES {pr.pricePerKg}/kg
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Full Tank (kg)
            </label>
            <input
              type="number"
              step="any"
              min="1"
              value={fullWeightKg}
              onChange={(e) => setFullWeightKg(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Rate per kg (KES)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-cyan-300 uppercase tracking-wider mb-1">
              Current Scale (kg)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={currentWeightKg}
              onChange={(e) => setCurrentWeightKg(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-[#0E1420] border border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Quick Scale Weight Stepper Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Quick Weights:</span>
          {[
            { label: '60kg (Full)', val: 60 },
            { label: '45kg (¾)', val: 45 },
            { label: '31kg (Demo)', val: 31 },
            { label: '30kg (Half)', val: 30 },
            { label: '15kg (¼)', val: 15 },
            { label: 'Empty', val: 0 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setCurrentWeightKg(item.val)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                currentWeightKg === item.val
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-[#0E1420] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Calculation Result Hero Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0E1420] via-cyan-950/40 to-[#0E1420] border border-cyan-600/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span>Calculated Stock Value</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              {result.fillPercentage}% Capacity
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div className="text-3xl font-mono font-black text-white tracking-tight">
              KES {result.totalValueKes.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              {result.weightKg} kg × KES {result.pricePerKg} = KES {result.totalValueKes.toLocaleString()}
            </div>
          </div>

          {/* Visual Tank Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 kg (Empty)</span>
              <span>{result.weightKg} kg remaining</span>
              <span>{result.fullWeightKg} kg (Full)</span>
            </div>
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, result.fillPercentage))}%` }}
              />
            </div>
          </div>

          {/* Additional Operational Insights */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
            <div className="text-slate-400">
              Full Tank Worth: <span className="font-mono text-white font-semibold">KES {(fullWeightKg * pricePerKg).toLocaleString()}</span>
            </div>
            <div className="text-slate-400">
              Dispensed / Consumed: <span className="font-mono text-cyan-300 font-semibold">{Math.max(0, fullWeightKg - currentWeightKg)} kg</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Values update automatically in shifts & reconciliation</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Close
            </button>
            {selectedProductId !== 'custom' && (
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-xs font-bold text-white shadow-lg shadow-cyan-950/60 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Counter Stock</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
