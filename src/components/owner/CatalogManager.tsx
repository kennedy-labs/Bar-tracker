import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductCategory, ProductUnit } from '../../types';
import { store } from '../../services/store';
import { weightMeasurementService } from '../../services/weightMeasurement';
import { WeightCalculatorModal } from '../common/WeightCalculatorModal';
import { StockAdjustmentModal } from '../common/StockAdjustmentModal';
import { useBackHandler } from '../../services/navigationHistory';
import {
  Wine,
  Plus,
  Search,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  X,
  TrendingUp,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  Scale,
  Minus,
  AlertCircle,
  PackageCheck,
  MoreVertical,
  Info,
} from 'lucide-react';

interface CountButtonProps {
  product: Product;
  stockOnHand: number;
  isLow: boolean;
  isOut: boolean;
  onLongPress: () => void;
}

const CountButton: React.FC<CountButtonProps> = ({
  product,
  stockOnHand,
  isLow,
  isOut,
  onLongPress,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const startPress = (clientX: number, clientY: number) => {
    isLongPressRef.current = false;
    touchStartPos.current = { x: clientX, y: clientY };
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, 500);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelPress();
    }
  };

  return (
    <button
      type="button"
      onTouchStart={(e) => startPress(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={(e) => {
        cancelPress();
        if (isLongPressRef.current) {
          e.preventDefault();
        }
      }}
      onTouchCancel={cancelPress}
      onTouchMove={handleTouchMove}
      onMouseDown={(e) => {
        if (e.button === 0) startPress(e.clientX, e.clientY);
      }}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      onDoubleClick={onLongPress}
      className={`w-14 sm:w-16 py-1.5 rounded-xl bg-[#0B0F17] border hover:border-emerald-500/50 active:scale-95 transition-all text-xs font-mono font-bold select-none cursor-pointer flex items-center justify-center gap-1.5 ${
        isOut
          ? 'text-rose-400 border-rose-900/60 bg-rose-950/20'
          : isLow
          ? 'text-amber-400 border-amber-900/60 bg-amber-950/20'
          : 'text-emerald-400 border-slate-800'
      }`}
      title="Count (Hold to edit stock)"
    >
      <span className="text-sm font-black tabular-nums">{stockOnHand}</span>
    </button>
  );
};

export const CatalogManager: React.FC = () => {
 const [, setTick] = useState(0);
 useEffect(() => {
 return store.subscribe(() => {
   setStockInputs({});
   setTick((t) => t + 1);
 });
 }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');

  // Streamlined view states: active 3-dot menu and expanded details drawers
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});

  // Phone back-button integration: close action menu if open
  useBackHandler(Boolean(activeMenuId), () => setActiveMenuId(null), 'catalog-item-menu');

  const toggleExpand = (productId: string) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // Direct Stock Input Handlers (Owner can type any number or click +/-)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [savedStockNotice, setSavedStockNotice] = useState<string | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<{
    product: Product;
    currentStock: number;
    targetStock?: number;
  } | null>(null);

  const handleStockChange = (productId: string, val: string) => {
    setStockInputs((prev) => ({ ...prev, [productId]: val }));
  };

  const handleStockCommit = (productId: string, currentVal: number) => {
    const rawVal = stockInputs[productId];
    if (rawVal === undefined || rawVal.trim() === '') return;
    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed < 0) {
      setStockInputs((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      return;
    }
    const num = Math.round(parsed * 100) / 100;
    if (num !== currentVal) {
      const prod = allProducts.find((p) => p.id === productId);
      if (prod && Math.abs(num - currentVal) >= 2) {
        // Open professional stock adjustment modal to specify clerical mistake vs shrinkage
        setAdjustingStockProduct({
          product: prod,
          currentStock: currentVal,
          targetStock: num,
        });
      } else {
        store.adjustProductStock(productId, num, {
          mode: 'CLERICAL_CORRECTION',
          reason: 'Catalog stock count update',
        });
        setSavedStockNotice(`Updated ${prod?.name || 'drink'} stock to ${num} ${prod?.unit.toLowerCase() || 'units'}`);
        setTimeout(() => setSavedStockNotice(null), 3500);
      }
    }
    setStockInputs((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handleStockStep = (productId: string, currentVal: number, delta: number) => {
    const nextVal = Math.max(0, Math.round((currentVal + delta) * 100) / 100);
    if (nextVal !== currentVal) {
      store.adjustProductStock(productId, nextVal, {
        mode: 'CLERICAL_CORRECTION',
        reason: delta > 0 ? 'Stock unit added' : 'Stock unit decremented',
      });
      const prod = allProducts.find((p) => p.id === productId);
      setSavedStockNotice(`Updated ${prod?.name || 'drink'} stock to ${nextVal} ${prod?.unit.toLowerCase() || 'units'}`);
      setTimeout(() => setSavedStockNotice(null), 3000);
    }
  };

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form State for Add / Edit
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('BEER');
  const [unit, setUnit] = useState<ProductUnit>('BOTTLE');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [initialStock, setInitialStock] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Measured Drink Modal States (Weight-based or Value-based Measurement)
  const [showMeasuredModal, setShowMeasuredModal] = useState(false);
  const [measuredEditingProduct, setMeasuredEditingProduct] = useState<Product | null>(null);
  const [measuredMode, setMeasuredMode] = useState<'WEIGHT' | 'VALUE'>('WEIGHT');
  const [measuredName, setMeasuredName] = useState('');
  const [measuredCategory, setMeasuredCategory] = useState<ProductCategory>('BEER');
  const [measuredFullWeight, setMeasuredFullWeight] = useState('60');
  const [measuredTareWeight, setMeasuredTareWeight] = useState('0');
  const [measuredPricePerKg, setMeasuredPricePerKg] = useState('150');
  const [measuredStock, setMeasuredStock] = useState('60');
  const [measuredError, setMeasuredError] = useState<string | null>(null);

  // Quick Keg Scale Calculator Modal
  const [showWeightCalcModal, setShowWeightCalcModal] = useState(false);
  const [weightCalcModalProductId, setWeightCalcModalProductId] = useState<string | undefined>(undefined);

  // Phone back-button integration: close any open product modal on phone back
  useBackHandler(showAddModal, () => setShowAddModal(false), 'catalog-add-modal');
  useBackHandler(Boolean(editingProduct), () => setEditingProduct(null), 'catalog-edit-modal');
  useBackHandler(Boolean(deletingProduct), () => setDeletingProduct(null), 'catalog-delete-modal');
  useBackHandler(showMeasuredModal, () => setShowMeasuredModal(false), 'catalog-measured-modal');
  useBackHandler(showWeightCalcModal, () => setShowWeightCalcModal(false), 'catalog-weight-calc-modal');
  useBackHandler(Boolean(adjustingStockProduct), () => setAdjustingStockProduct(null), 'catalog-adjust-stock-modal');

  // Quick Inline Price Editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineSell, setInlineSell] = useState('');

  const allProducts = store.getProducts(true);
  const inventory = store.getInventory();

  // Filter products
  const filteredProducts = allProducts.filter((p) => {
    if (!showArchived && p.isArchived) return false;
    if (showArchived && !p.isArchived) return false;

    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat =
      selectedCategory === 'ALL' || p.category === selectedCategory;

    const inv = inventory.find((i) => i.productId === p.id);
    const stockOnHand = inv ? inv.quantityOnHand : 0;
    const isLow = stockOnHand <= (p.reorderLevel ?? 5);

    const matchesStockFilter = stockStatusFilter === 'ALL' || isLow;

    return matchesSearch && matchesCat && matchesStockFilter;
  });

  const activeProducts = allProducts.filter((p) => !p.isArchived);
  const archivedProducts = allProducts.filter((p) => p.isArchived);

  // Stock Audit & Inventory Analytics
  const totalActiveCount = activeProducts.length;
  const totalStockUnits = activeProducts.reduce((sum, p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    return sum + (inv ? inv.quantityOnHand : 0);
  }, 0);
  const lowStockCount = activeProducts.filter((p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    const qty = inv ? inv.quantityOnHand : 0;
    return qty <= (p.reorderLevel ?? 5);
  }).length;
  const totalRetailValue = activeProducts.reduce((sum, p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    const qty = inv ? inv.quantityOnHand : 0;
    const val = (p.isMeasured || p.unit === 'VALUE_KES') ? qty : qty * p.sellingPrice;
    return sum + val;
  }, 0);

 // Categories list
 const categories: { key: string; label: string }[] = [
 { key: 'ALL', label: 'All Drinks' },
 { key: 'BEER', label: 'Beers' },
 { key: 'CIDER', label: 'Ciders' },
 { key: 'SPIRIT', label: 'Spirits & Whiskeys' },
 { key: 'WINE', label: 'Wines' },
 { key: 'SOFT_DRINK', label: 'Soft Drinks & Sodas' },
 { key: 'TRADITIONAL_BREW', label: 'Traditional Brew & Continuous' },
 { key: 'CIGARETTE', label: 'Cigarettes' },
 ];

 const units: { key: ProductUnit; label: string }[] = [
 { key: 'BOTTLE', label: 'Bottle' },
 { key: 'CAN', label: 'Can' },
 { key: 'SHOT_TOT', label: 'Shot / Tot' },
 { key: 'CRATE', label: 'Crate' },
 { key: 'PACK', label: 'Pack' },
 { key: 'LITRE', label: 'Litre' },
 { key: 'JUG', label: 'Jug' },
 { key: 'CUP', label: 'Cup' },
 { key: 'KEG', label: 'Keg' },
 { key: 'PORTION', label: 'Portion' },
 { key: 'VALUE_KES', label: 'KES Monetary Value' },
 { key: 'CUSTOM', label: 'Custom' },
 ];

 // Open Add Modal
 const handleOpenAdd = () => {
   setName('');
   setCategory('BEER');
   setUnit('BOTTLE');
   setSellingPrice('');
   setReorderLevel('5');
   setInitialStock('');
   setVolumeMl('');
   setFormError(null);
   setEditingProduct(null);
   setShowAddModal(true);
 };

 // Open Add Measured Modal
 const handleOpenAddMeasured = () => {
   setMeasuredEditingProduct(null);
   setMeasuredMode('WEIGHT');
    setMeasuredName('');
   setMeasuredCategory('BEER');
    setMeasuredFullWeight('');
   setMeasuredTareWeight('0');
    setMeasuredPricePerKg('');
    setMeasuredStock('');
   setMeasuredError(null);
   setShowMeasuredModal(true);
 };

 // Open Edit Modal (Auto-routes measured products to the measured modal)
 const handleOpenEdit = (p: Product) => {
   if (p.isMeasured) {
     setMeasuredEditingProduct(p);
     setMeasuredName(p.name);
     setMeasuredCategory(p.category);
     const invItem = inventory.find((i) => i.productId === p.id);

     if (p.measurementType === 'WEIGHT' || p.unit === 'KG') {
       setMeasuredMode('WEIGHT');
       setMeasuredFullWeight(String(p.fullWeightKg || 60));
       setMeasuredTareWeight(String(p.emptyWeightKg || 0));
       setMeasuredPricePerKg(String(p.pricePerKg || p.sellingPrice || 150));
       setMeasuredStock(String(invItem?.quantityOnHand ?? p.fullWeightKg ?? 60));
     } else {
       setMeasuredMode('VALUE');
       setMeasuredStock(String(invItem?.quantityOnHand ?? p.totalMeasuredValueKes ?? 0));
     }

     setMeasuredError(null);
     setShowMeasuredModal(true);
     return;
   }

   setEditingProduct(p);
   setName(p.name);
   setCategory(p.category);
   setUnit(p.unit);
   setSellingPrice(String(p.sellingPrice));
   setReorderLevel(String(p.reorderLevel || 5));
   setInitialStock('0');
   setVolumeMl(p.volumeMl ? String(p.volumeMl) : '');
   setFormError(null);
   setShowAddModal(true);
 };

 // Save Add or Edit
 const handleSubmitProduct = (e: React.FormEvent) => {
   e.preventDefault();
   setFormError(null);

   const sell = parseFloat(sellingPrice);
   const reorder = parseFloat(reorderLevel) || 5;
   const stock = parseFloat(initialStock) || 0;
   const vol = volumeMl ? parseInt(volumeMl, 10) : undefined;

   if (!name.trim()) {
     setFormError('Please enter a drink name.');
     return;
   }

   if (isNaN(sell) || sell <= 0) {
     setFormError('Please enter a valid retail selling price.');
     return;
   }

   if (editingProduct) {
     // Updating existing product
     store.updateProduct(editingProduct.id, {
       name: name.trim(),
       category,
       unit,
       sellingPrice: sell,
       reorderLevel: reorder,
       volumeMl: vol,
     });
   } else {
     // Adding new product
     store.addProduct({
       name: name.trim(),
       category,
       unit,
       sellingPrice: sell,
       reorderLevel: reorder,
       volumeMl: vol,
       initialStock: stock,
     });
   }

   setShowAddModal(false);
   setEditingProduct(null);
 };

 // Save Add or Edit Measured Product (Weight-based or Value-based Measurement)
 const handleSubmitMeasuredProduct = (e: React.FormEvent) => {
   e.preventDefault();
   setMeasuredError(null);

   if (!measuredName.trim()) {
     setMeasuredError('Please enter a drink name (e.g. Tusker Keg Draft, Makali, Muratina).');
     return;
   }

   if (measuredMode === 'WEIGHT') {
     const fullWeight = parseFloat(measuredFullWeight) || 60;
     const tareWeight = parseFloat(measuredTareWeight) || 0;
     const rate = parseFloat(measuredPricePerKg);
     if (isNaN(rate) || rate <= 0) {
       setMeasuredError('Please enter a valid price per kilogram (KES/kg).');
       return;
     }

     const stockKg = parseFloat(measuredStock);
     if (isNaN(stockKg) || stockKg < 0) {
       setMeasuredError('Please enter a valid scale weight in kilograms (kg).');
       return;
     }

     const cleanStockKg = Math.round(stockKg * 100) / 100;
     const totalVal = Math.round(cleanStockKg * rate * 100) / 100;

     if (measuredEditingProduct) {
       store.updateProduct(measuredEditingProduct.id, {
         name: measuredName.trim(),
         category: measuredCategory,
         unit: 'KG',
         sellingPrice: rate,
         pricePerKg: rate,
         fullWeightKg: fullWeight,
         emptyWeightKg: tareWeight,
         isMeasured: true,
         measurementType: 'WEIGHT',
         measureUnitLabel: 'kg',
         totalMeasuredValueKes: totalVal,
       });

       store.adjustProductStock(measuredEditingProduct.id, cleanStockKg);
     } else {
       store.addProduct({
         name: measuredName.trim(),
         category: measuredCategory,
         unit: 'KG',
         sellingPrice: rate,
         pricePerKg: rate,
         fullWeightKg: fullWeight,
         emptyWeightKg: tareWeight,
         initialStock: cleanStockKg,
         reorderLevel: 10,
         isMeasured: true,
         measurementType: 'WEIGHT',
         measureUnitLabel: 'kg',
         totalMeasuredValueKes: totalVal,
       });
     }

     setShowMeasuredModal(false);
     setMeasuredEditingProduct(null);
     return;
   }

   const stock = parseFloat(measuredStock);
   if (isNaN(stock) || stock < 0) {
     setMeasuredError('Please enter a valid counter stock value in KES.');
     return;
   }

   const cleanStock = Math.round(stock * 100) / 100;

   if (measuredEditingProduct) {
     store.updateProduct(measuredEditingProduct.id, {
       name: measuredName.trim(),
       category: measuredCategory,
       unit: 'VALUE_KES',
       sellingPrice: 1,
       isMeasured: true,
       measurementType: 'VALUE',
       measureUnitLabel: 'KES Value',
       totalMeasuredValueKes: cleanStock,
     });

     // Update on-shelf inventory
     store.adjustProductStock(measuredEditingProduct.id, cleanStock);
   } else {
     store.addProduct({
       name: measuredName.trim(),
       category: measuredCategory,
       unit: 'VALUE_KES',
       sellingPrice: 1,
       initialStock: cleanStock,
       reorderLevel: 200,
       isMeasured: true,
       measurementType: 'VALUE',
       measureUnitLabel: 'KES Value',
       totalMeasuredValueKes: cleanStock,
     });
   }

   setShowMeasuredModal(false);
   setMeasuredEditingProduct(null);
 };

 // Handle Archive or Delete
 const handleConfirmArchiveOrDelete = (permanent: boolean) => {
 if (!deletingProduct) return;
 store.deleteProduct(deletingProduct.id, permanent);
 setDeletingProduct(null);
 };

 // Handle Restore
 const handleRestore = (productId: string) => {
 store.restoreProduct(productId);
 };

 // Save inline edit
 const handleSaveInline = (productId: string) => {
   const sell = parseFloat(inlineSell);
   if (!isNaN(sell) && sell >= 0) {
     store.updateProductPricing(productId, sell);
   }
   setInlineEditId(null);
 };

 const handleRestoreTemplate = () => {
 store.restoreDefaultCatalog();
 };



  return (
    <div className="space-y-4">
      {/* 1. Header & Catalog Controls */}
      <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Drinks & Stock
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleOpenAdd}
              className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Drink</span>
            </button>

            <button
              onClick={handleOpenAddMeasured}
              className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer shrink-0"
            >
              <Scale className="w-4 h-4 text-cyan-200" />
              <span>Add Measured</span>
            </button>
          </div>
        </div>


        {/* Search, Category Filter & Stock Filter Toggle */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search drink by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0E1420] border border-slate-800 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>


          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === c.key
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                    : 'bg-[#0E1420] text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. UNIFIED DRINKS & STOCK AUDIT ITEM LIST */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-[#121824] border border-[#1E293B]">
          <h3 className="text-sm font-bold text-white">No drinks found.</h3>
          <p className="text-xs text-slate-400 mt-2">Add your drinks to get started.</p>
        </div>
      ) : (
        <>
          {/* STREAMLINED READ-ONLY ITEM LIST */}
          <div className="space-y-2.5">
            {filteredProducts.map((p) => {
              const inv = inventory.find((i) => i.productId === p.id);
              const stockOnHand = inv ? inv.quantityOnHand : 0;
              const reorderThreshold = p.reorderLevel ?? 5;
              const isLow = stockOnHand <= reorderThreshold;
              const isOut = stockOnHand === 0;
              const isExpanded = Boolean(expandedItemIds[p.id]);
              const isMenuOpen = activeMenuId === p.id;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border transition-all ${
                    p.isArchived
                      ? 'bg-[#121824]/60 border-slate-800/60 opacity-75'
                      : 'bg-[#121824] border-[#1E293B] hover:border-slate-700'
                  }`}
                >
                  {/* Main Item Row: (a) Name, (b) Count [read-only, hold to edit], (c) Selling Price, (d) 3-dot menu */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    {/* a) Name & Subtle Price */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base truncate">
                          {p.name}
                        </span>
                        {p.isArchived && (
                          <span className="text-[10px] text-amber-400 font-mono shrink-0">
                            (Archived)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.isMeasured ? (
                          <span className="text-cyan-400/70 text-[10px] font-mono font-medium">
                            Measured Value
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-mono">
                            KES {p.sellingPrice.toLocaleString()}
                          </span>
                        )}
                        <span className="text-slate-600 text-[10px] uppercase tracking-tight">
                          · {p.unit.toLowerCase()}
                        </span>
                      </div>
                    </div>

                    {/* b) Count (Read-only; Owner long-presses to edit) */}
                    <div className="w-14 sm:w-16 shrink-0 flex justify-center">
                      <CountButton
                        product={p}
                        stockOnHand={stockOnHand}
                        isLow={isLow}
                        isOut={isOut}
                        onLongPress={() => {
                          setAdjustingStockProduct({
                            product: p,
                            currentStock: stockOnHand,
                          });
                        }}
                      />
                    </div>

                    {/* 3 Vertical Dot Menu Icon */}
                    <div className="w-8 shrink-0 flex justify-end relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : p.id)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          isMenuOpen
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                        }`}
                        title="Item Actions"
                        aria-label="Item Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Action Popover Menu */}
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-2xl bg-[#0E1420] border border-slate-800 shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100 font-sans">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => {
                                toggleExpand(p.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                            >
                              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                            </button>

                            {/* Edit Product */}
                            {!p.isArchived && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenEdit(p);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Edit Product</span>
                              </button>
                            )}

                            {/* Delete Product / Restore */}
                            {!p.isArchived ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingProduct(p);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors text-left cursor-pointer border-t border-slate-800/80"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span>Delete Product</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  handleRestore(p.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-400 hover:text-white hover:bg-emerald-950/40 transition-colors text-left cursor-pointer border-t border-slate-800/80 font-bold"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Restore Product</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Details Drawer: displays non-redundant specs (category, container unit, volume, reorder alert) */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-[#0B0F17] border-t border-slate-800/80 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300 font-sans">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Category</span>
                          <span className="text-slate-200 font-medium capitalize">
                            {p.category.replace('_', ' ').toLowerCase()}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Container Unit</span>
                          <span className="text-slate-200 font-medium capitalize">
                            {p.unit.toLowerCase()}
                          </span>
                        </div>

                        {p.volumeMl && !p.isMeasured && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-mono">Bottle Volume</span>
                            <span className="text-slate-200 font-medium">{p.volumeMl} ml</span>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Reorder Alert</span>
                          <span className="text-slate-200 font-medium">≤ {reorderThreshold} units</span>
                        </div>

                        {p.isMeasured && (
                          <div>
                            <span className="text-[10px] text-cyan-400 uppercase block font-mono">Measurement Mode</span>
                            <span className="text-cyan-300 font-medium">Weight / Scale</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </>
      )}

  {/* 3. MODAL: ADD / EDIT PRODUCT */}
 {showAddModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
 <div className="w-full max-w-lg bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-6 shadow-2xl my-6">
 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
 {editingProduct ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
 </div>
 <h3 className="text-base font-bold text-white tracking-tight">
 {editingProduct ? 'Edit Drink Information' : 'Add New Drink to Catalog'}
 </h3>
 </div>
 <button
 onClick={() => setShowAddModal(false)}
 className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {formError && (
 <div className="mt-3 p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
 <span>{formError}</span>
 </div>
 )}

 <form onSubmit={handleSubmitProduct} className="mt-4 space-y-4">
 {/* Product Name */}
 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Drink Name & Volume
 </label>
 <input
 type="text"
 required
 autoFocus
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
 />
 </div>

 {/* Category & Unit */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Category
 </label>
 <select
 value={category}
 onChange={(e) => setCategory(e.target.value as ProductCategory)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
 >
 <option value="BEER">Beer</option>
 <option value="CIDER">Cider</option>
 <option value="SPIRIT">Spirit / Whiskey</option>
 <option value="WINE">Wine</option>
 <option value="SOFT_DRINK">Soft Drink / Soda</option>
 <option value="CIGARETTE">Cigarette</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Serving Unit
 </label>
 <select
 value={unit}
 onChange={(e) => setUnit(e.target.value as ProductUnit)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
 >
 {units.map((u) => (
 <option key={u.key} value={u.key}>
 {u.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Selling Price */}
 <div>
   <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
     Selling Price (KES)
   </label>
   <div className="relative">
     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-emerald-400">
       KES
     </span>
     <input
       type="number"
       step="any"
       min="1"
       required
       value={sellingPrice}
       onChange={(e) => setSellingPrice(e.target.value)}
       className="w-full bg-[#0E1420] border border-emerald-500/80 rounded-xl pl-12 pr-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
     />
   </div>
 </div>


 {/* Initial Stock & Reorder Alert Level */}
 <div className="grid grid-cols-2 gap-3">
 {!editingProduct && (
 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Stock
 </label>
 <input
 type="number"
 step="any"
 min="0"
 value={initialStock}
 onChange={(e) => setInitialStock(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
 />
 </div>
 )}

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Low Stock Alert Level
 </label>
 <input
 type="number"
 step="any"
 min="0.5"
 value={reorderLevel}
 onChange={(e) => setReorderLevel(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
 />
 </div>

 </div>

 {/* Buttons */}
 <div className="flex items-center gap-2 pt-2">
 <button
 type="button"
 onClick={() => setShowAddModal(false)}
 className="py-3 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
 >
 <Check className="w-4 h-4" />
 <span>{editingProduct ? 'Save Drink Changes' : 'Add Drink'}</span>
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* 4. MODAL: CONFIRM ARCHIVE / DELETE */}
 {deletingProduct && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
 <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-2xl space-y-4">
 <div className="flex items-center gap-2.5 text-red-400">
 <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center">
 <Trash2 className="w-4 h-4" />
 </div>
 <h3 className="text-base font-bold text-white">
 Remove &ldquo;{deletingProduct.name}&rdquo;?
 </h3>
 </div>

 <p className="text-xs text-slate-300 leading-relaxed">
 Choose how you would like to handle this drink:
 </p>

 <div className="space-y-2">
 <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs">
 <div className="font-bold text-white flex items-center gap-1.5">
 <Archive className="w-3.5 h-3.5 text-amber-400" />
 <span>Archive (Recommended)</span>
 </div>
 <p className="text-slate-400 text-[11px] mt-1">
 Removes the drink from active counter shelves so attendants can no longer sell it, while safely keeping past shift sales records and audit history intact.
 </p>
 </div>

 <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs">
 <div className="font-bold text-red-400 flex items-center gap-1.5">
 <Trash2 className="w-3.5 h-3.5" />
 <span>Permanent Delete</span>
 </div>
 <p className="text-slate-400 text-[11px] mt-1">
 Completely wipes the drink definition from the catalog.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 pt-1">
 <button
 type="button"
 onClick={() => setDeletingProduct(null)}
 className="py-2.5 px-3.5 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
 >
 Cancel
 </button>

 <button
 type="button"
 onClick={() => handleConfirmArchiveOrDelete(false)}
 className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
 >
 <Archive className="w-3.5 h-3.5" />
 <span>Archive Drink</span>
 </button>

 <button
 type="button"
 onClick={() => handleConfirmArchiveOrDelete(true)}
 className="py-2.5 px-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
 >
 <span>Delete</span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 5. MODAL: ADD / EDIT MEASURED DRINK (WEIGHT OR VALUE BASED) */}
 {showMeasuredModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
 <div className="w-full max-w-lg bg-[#121824] border border-cyan-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
 {/* Modal Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
 <div className="flex items-center gap-2.5">
 <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
 <Scale className="w-5 h-5" />
 </div>
 <div>
 <h3 className="text-base font-bold text-white tracking-tight">
 {measuredEditingProduct ? 'Edit Measured Drink' : 'Add Measured Drink'}
 </h3>
 <p className="text-[11px] text-cyan-300">
 {measuredMode === 'WEIGHT'
   ? 'Drink measured by weight'
   : 'Continuous drink measured by monetary value (e.g. Muratina, Makali)'}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => {
 setShowMeasuredModal(false);
 setMeasuredEditingProduct(null);
 setMeasuredError(null);
 }}
 className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Measurement Type Mode Selector */}
 <div className="grid grid-cols-2 gap-2 p-1 bg-[#0E1420] rounded-2xl border border-slate-800">
   <button
     type="button"
     onClick={() => {
       setMeasuredMode('WEIGHT');
     }}
     className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
       measuredMode === 'WEIGHT'
         ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 shadow-sm'
         : 'text-slate-400 hover:text-white border border-transparent'
     }`}
   >
     <Scale className="w-3.5 h-3.5" />
     <span>By Weight (Keg / kg)</span>
   </button>

   <button
     type="button"
     onClick={() => {
       setMeasuredMode('VALUE');
     }}
     className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
       measuredMode === 'VALUE'
         ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 shadow-sm'
         : 'text-slate-400 hover:text-white border border-transparent'
     }`}
   >
     <TrendingUp className="w-3.5 h-3.5" />
     <span>By Value (KES)</span>
   </button>
 </div>

 {measuredError && (
 <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
 <span>{measuredError}</span>
 </div>
 )}

 <form onSubmit={handleSubmitMeasuredProduct} className="space-y-4">
 {/* Quick Preset Staples */}
 {!measuredEditingProduct && (
   <div>
     <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
       Quick Staples ({measuredMode === 'WEIGHT' ? 'Keg Tanks' : 'Traditional'})
     </label>
     <div className="flex flex-wrap gap-1.5">
        {measuredMode === 'WEIGHT' ? null : (
         [
           { name: 'Makali', price: '1500' },
           { name: 'Muratina', price: '1500' },
           { name: 'Busaa / Local Brew', price: '1200' },
           { name: 'Palm Wine (Mnazi)', price: '1000' },
         ].map((preset) => (
           <button
             key={preset.name}
             type="button"
             onClick={() => {
               setMeasuredName(preset.name);
               setMeasuredStock(preset.price);
             }}
             className="py-1 px-2.5 rounded-lg bg-[#0E1420] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-xs text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
           >
             +{preset.name}
           </button>
         ))
       )}
     </div>
   </div>
 )}

 {/* Drink Name */}
 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Drink Name
 </label>
 <input
 type="text"
 required
 autoFocus
 value={measuredName}
 onChange={(e) => setMeasuredName(e.target.value)}
 placeholder={measuredMode === 'WEIGHT' ? 'e.g. Tusker Keg Draft 60kg' : 'e.g. Makali, Muratina'}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
 />
 </div>

 {/* Category */}
 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Category
 </label>
 <select
 value={measuredCategory}
 onChange={(e) => setMeasuredCategory(e.target.value as ProductCategory)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
 >
 <option value="BEER">Beer / Keg Draft</option>
 <option value="TRADITIONAL_BREW">Traditional Brew & Continuous</option>
 <option value="WINE">Wine (Carafe / Dispenser)</option>
 <option value="SPIRIT">Spirit / Whiskey Dispenser</option>
 <option value="SOFT_DRINK">Soft Drink / Juice</option>
 </select>
 </div>

 {measuredMode === 'WEIGHT' ? (
   /* Weight Configuration Fields */
    <div className="space-y-3 p-4 rounded-2xl bg-[#0E1420] border border-cyan-800/80">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

       <div>
         <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
           Price per kg (KES)
         </label>
         <input
           type="number"
           step="any"
           min="1"
           required
           value={measuredPricePerKg}
           onChange={(e) => setMeasuredPricePerKg(e.target.value)}
           className="w-full bg-[#121824] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
           
         />
         <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 150 KES/kg</span>
       </div>

       <div>
         <label className="block text-[11px] font-semibold text-cyan-300 uppercase tracking-wider mb-1">
           Scale Weight (kg)
         </label>
         <input
           type="number"
           step="any"
           min="0"
           required
           value={measuredStock}
           onChange={(e) => setMeasuredStock(e.target.value)}
           className="w-full bg-[#121824] border border-cyan-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
           
         />
         <span className="text-[10px] text-cyan-400 mt-0.5 block">Current scale reading</span>
       </div>
     </div>

   </div>
 ) : (
   /* Pure Value Measurement - Value IS Selling Price */
   <div className="space-y-3 p-3.5 rounded-2xl bg-[#0E1420] border border-cyan-900/60">
     <div>
       <div className="flex items-center justify-between mb-1">
         <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
           <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
           <span>Current Stock on Shelf (KES Value)</span>
         </label>
         <span className="text-[10px] text-cyan-400 font-mono font-semibold">1 KES Stock = 1 KES Selling Worth</span>
       </div>
       <input
         type="number"
         step="any"
         min="0"
         required
         value={measuredStock}
         onChange={(e) => setMeasuredStock(e.target.value)}
         className="w-full bg-[#121824] border border-cyan-500/80 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
         
       />
       <span className="text-[10px] text-slate-400 mt-1 block">
         Total KES worth of drink currently remaining on the counter.
       </span>
     </div>
   </div>
 )}

 {/* Action Buttons */}
 <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
 <button
 type="button"
 onClick={() => {
 setShowMeasuredModal(false);
 setMeasuredEditingProduct(null);
 setMeasuredError(null);
 }}
 className="py-3 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="flex-1 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/60 cursor-pointer"
 >
 <Check className="w-4 h-4" />
 <span>
 {measuredEditingProduct
 ? 'Save Changes'
 : 'Add Measured Drink'}
 </span>
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Quick Keg Scale Calculator Modal */}
 <WeightCalculatorModal
   isOpen={showWeightCalcModal}
   onClose={() => setShowWeightCalcModal(false)}
   initialProductId={weightCalcModalProductId}
 />

 {/* Professional Stock Adjustment Modal */}
 {adjustingStockProduct && (
   <StockAdjustmentModal
     isOpen={Boolean(adjustingStockProduct)}
     onClose={() => setAdjustingStockProduct(null)}
     product={adjustingStockProduct.product}
     currentStock={adjustingStockProduct.currentStock}
     initialTargetStock={adjustingStockProduct.targetStock}
     currentUser={store.getSessionUser() || { id: 'owner', name: 'Owner', role: 'OWNER', username: 'owner' }}
     onSuccess={(newQty, mode) => {
       setSavedStockNotice(
         `Stock count for ${adjustingStockProduct.product.name} updated to ${newQty} (${
           mode === 'REAL_RESTOCK'
             ? 'Real Stock Added'
             : mode === 'CLERICAL_CORRECTION'
             ? 'Clerical Correction'
             : 'Shrinkage Flagged'
         })`
       );
       setTimeout(() => setSavedStockNotice(null), 3500);
     }}
   />
 )}
 </div>
 );
};
