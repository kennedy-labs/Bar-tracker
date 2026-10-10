import React, { useState, useEffect } from 'react';
import { Product, ProductCategory, ProductUnit } from '../../types';
import { store } from '../../services/store';
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
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  Scale,
  LayoutList,
  LayoutGrid,
  Minus,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';

export const CatalogManager: React.FC = () => {
 const [, setTick] = useState(0);
 useEffect(() => {
 return store.subscribe(() => setTick((t) => t + 1));
 }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');

  // Direct Stock Input Handlers (Owner can type any number or click +/-)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [savedStockNotice, setSavedStockNotice] = useState<string | null>(null);

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
      store.adjustProductStock(productId, num);
      const prod = allProducts.find((p) => p.id === productId);
      setSavedStockNotice(`Updated ${prod?.name || 'drink'} stock to ${num} ${prod?.unit.toLowerCase() || 'units'}`);
      setTimeout(() => setSavedStockNotice(null), 3500);
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
      store.adjustProductStock(productId, nextVal);
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

  // Measured Drink Modal States (Pure Value Measurement)
  const [showMeasuredModal, setShowMeasuredModal] = useState(false);
  const [measuredEditingProduct, setMeasuredEditingProduct] = useState<Product | null>(null);
  const [measuredName, setMeasuredName] = useState('');
  const [measuredCategory, setMeasuredCategory] = useState<ProductCategory>('TRADITIONAL_BREW');
  const [measuredStock, setMeasuredStock] = useState('1500');
  const [measuredError, setMeasuredError] = useState<string | null>(null);

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
   setMeasuredName('');
   setMeasuredCategory('TRADITIONAL_BREW');
   setMeasuredStock('1500');
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
     setMeasuredStock(String(invItem?.quantityOnHand ?? p.totalMeasuredValueKes ?? 0));
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

 // Save Add or Edit Measured Product (Pure Value Measurement)
 const handleSubmitMeasuredProduct = (e: React.FormEvent) => {
   e.preventDefault();
   setMeasuredError(null);

   if (!measuredName.trim()) {
     setMeasuredError('Please enter a drink name (e.g. Makali, Muratina).');
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
      <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wine className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-black text-white tracking-tight">
                Drinks Catalog & Price Architecture
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Unified catalog & stock audit. Manage menu drinks, selling prices, and record physical on-hand stock balances directly.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* View Mode Toggle: Table vs Cards */}
            <div className="flex items-center bg-[#0E1420] border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View (Ideal for inventory audits)"
                className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card Grid View"
                className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showArchived
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-[#0E1420] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'Active Drinks' : `Archived (${archivedProducts.length})`}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Drink</span>
            </button>

            <button
              onClick={handleOpenAddMeasured}
              className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Add continuous or measured drinks like Muratina, traditional brew, kegs, or bulk wine"
            >
              <Scale className="w-4 h-4 text-cyan-200" />
              <span className="hidden sm:inline">Add Measured Drink</span>
              <span className="sm:hidden">Measured</span>
            </button>
          </div>
        </div>

        {/* Live Saved Stock Notice Banner */}
        {savedStockNotice && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedStockNotice}</span>
          </div>
        )}

        {/* 2. Stock Audit & Inventory Analytics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wine className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Catalog</span>
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-white">
              {totalActiveCount} <span className="text-xs text-slate-400 font-sans font-normal">SKUs</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PackageCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stock On Shelf</span>
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-cyan-300">
              {totalStockUnits.toLocaleString()} <span className="text-xs text-slate-400 font-sans font-normal">units</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStockStatusFilter(stockStatusFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
            className={`p-3 sm:p-3.5 rounded-2xl border text-left space-y-1 transition-all cursor-pointer ${
              stockStatusFilter === 'LOW_STOCK'
                ? 'bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-[#0E1420] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Restock Alerts</span>
              </span>
              <span className="text-[9px] text-slate-400">
                {stockStatusFilter === 'LOW_STOCK' ? 'Filtering' : 'Click to filter'}
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-mono font-bold ${lowStockCount > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
              {lowStockCount} <span className="text-xs font-sans font-normal">{lowStockCount === 1 ? 'drink low' : 'drinks low'}</span>
            </div>
          </button>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Inventory Value</span>
            </div>
            <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
              KES {totalRetailValue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Retail / Selling Worth
            </div>
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

            {/* Quick stock alert filter pills */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStockStatusFilter('ALL')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  stockStatusFilter === 'ALL'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('LOW_STOCK')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${
                  stockStatusFilter === 'LOW_STOCK'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#0E1420] text-amber-400 hover:text-amber-300 border border-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Restock Needed ({lowStockCount})</span>
              </button>
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
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              {allProducts.length === 0 ? 'Clean Slate Active — Ready for Your Real Drinks' : 'No Drinks Found'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {allProducts.length === 0
                ? 'Your menu is empty with zero test data. Add drinks individually or load starters so attendants can begin recording shift sales.'
                : showArchived
                ? 'No archived drinks match your filters.'
                : stockStatusFilter === 'LOW_STOCK'
                ? 'All drinks currently have adequate stock on hand above reorder thresholds.'
                : 'No drinks match your search or category filter.'}
            </p>
          </div>
          {allProducts.length === 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                onClick={handleOpenAdd}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#151D2C] hover:bg-[#1E293B] border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Single Drink</span>
              </button>
              <button
                onClick={handleOpenAddMeasured}
                className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/60 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-4 h-4 text-cyan-400" />
                <span>Add Measured Drink</span>
              </button>
              <button
                onClick={handleRestoreTemplate}
                className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-transparent hover:bg-slate-800/40 text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer"
              >
                Load Starter Template
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* VIEW A: AUDIT TABLE VIEW (Desktop / Tablet) */}
          {viewMode === 'table' && (
            <div className="hidden md:block overflow-x-auto border border-[#1E293B] rounded-3xl bg-[#0E1420] shadow-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Product Name & Category</th>
                    <th className="p-3.5 text-center">Selling Price</th>
                    <th className="p-3.5 text-center text-emerald-400">Stock On Hand (Editable Audit)</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredProducts.map((p) => {
                    const isInline = inlineEditId === p.id;
                    const inv = inventory.find((i) => i.productId === p.id);
                    const stockOnHand = inv ? inv.quantityOnHand : 0;
                    const reorderThreshold = p.reorderLevel ?? 5;
                    const isLow = stockOnHand <= reorderThreshold;
                    const isOut = stockOnHand === 0;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          p.isArchived ? 'opacity-60 bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Name & Details */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-bold text-white text-sm">
                              {p.name}
                            </span>
                            {p.isMeasured && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1">
                                <Scale className="w-2.5 h-2.5" />
                                <span>Measured</span>
                              </span>
                            )}
                            {p.isArchived && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="capitalize">{p.category.replace('_', ' ').toLowerCase()}</span>
                            <span>·</span>
                            <span>{p.unit.toLowerCase()}</span>
                            {p.volumeMl && !p.isMeasured && (
                              <>
                                <span>·</span>
                                <span>{p.volumeMl}ml</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Selling Price */}
                        <td className="p-3.5 text-center">
                          {p.isMeasured ? (
                            <span className="text-cyan-400 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/60" title="Stock value on counter directly equals selling price">
                              Value-based
                            </span>
                          ) : isInline ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-emerald-500 text-[10px]">KES</span>
                              <input
                                type="number"
                                value={inlineSell}
                                onChange={(e) => setInlineSell(e.target.value)}
                                className="w-16 px-1.5 py-0.5 bg-[#151D2C] border border-emerald-500 rounded text-center text-emerald-400 font-bold"
                              />
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-bold">
                              KES {p.sellingPrice.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Stock On Hand (Editable Audit Input + Step Buttons) */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStockStep(p.id, stockOnHand, -1)}
                              disabled={p.isArchived || stockOnHand <= 0}
                              className="w-6 h-6 rounded-md bg-[#151D2C] hover:bg-slate-800 disabled:opacity-40 text-slate-300 flex items-center justify-center border border-slate-700 cursor-pointer"
                              title="Decrease stock count by 1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              step="any"
                              min="0"
                              disabled={p.isArchived}
                              value={stockInputs[p.id] !== undefined ? stockInputs[p.id] : stockOnHand}
                              onChange={(e) => handleStockChange(p.id, e.target.value)}
                              onBlur={() => handleStockCommit(p.id, stockOnHand)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={`w-18 px-2 py-1 bg-[#151D2C] hover:bg-[#1A2436] focus:bg-[#0E1420] text-center font-mono font-bold text-sm border rounded-lg outline-none transition-colors ${
                                isOut
                                  ? 'text-red-400 border-red-800/80 focus:border-red-500'
                                  : isLow
                                  ? 'text-amber-400 border-amber-800/80 focus:border-amber-500'
                                  : 'text-emerald-300 border-slate-700 focus:border-emerald-500'
                              }`}
                              title="Type count (e.g. 9.5 for half bottle) and press Enter or click outside to save"
                            />

                            <button
                              type="button"
                              onClick={() => handleStockStep(p.id, stockOnHand, 1)}
                              disabled={p.isArchived}
                              className="w-6 h-6 rounded-md bg-[#151D2C] hover:bg-slate-800 disabled:opacity-40 text-slate-300 flex items-center justify-center border border-slate-700 cursor-pointer"
                              title="Increase stock count by 1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>

                            <span className="text-[10px] text-slate-500 font-mono pl-1">
                              {p.isMeasured && (p.measurementType === 'VALUE' || p.unit === 'VALUE_KES')
                                ? 'val'
                                : p.unit.toLowerCase()}
                            </span>
                          </div>
                        </td>

                        {/* Stock Health Status */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`text-[10px] font-sans px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 ${
                              isOut
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : isLow
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {isOut ? (
                              'Out of Stock'
                            ) : isLow ? (
                              <>
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                <span>Restock Needed (≤{reorderThreshold})</span>
                              </>
                            ) : (
                              'Adequate'
                            )}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {isInline ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleSaveInline(p.id)}
                                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                  title="Save prices"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setInlineEditId(null)}
                                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {!p.isArchived && !p.isMeasured && (
                                  <button
                                    onClick={() => {
                                      setInlineEditId(p.id);
                                      setInlineSell(String(p.sellingPrice));
                                    }}
                                    className="px-2 py-1 rounded-lg bg-[#151D2C] hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                                    title="Quick Price Edit"
                                  >
                                    Price
                                  </button>
                                )}
                                {!p.isArchived ? (
                                  <>
                                    <button
                                      onClick={() => handleOpenEdit(p)}
                                      title="Full Edit Details"
                                      className="p-1.5 rounded-lg bg-[#151D2C] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingProduct(p)}
                                      title="Archive or Delete"
                                      className="p-1.5 rounded-lg bg-[#151D2C] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleRestore(p.id)}
                                    className="py-1 px-2.5 rounded-lg bg-emerald-950 border border-emerald-700 text-emerald-400 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Restore</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW B: CARDS VIEW (Mobile + Grid view) */}
          <div className={`${viewMode === 'table' ? 'md:hidden' : ''} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5`}>
            {filteredProducts.map((p) => {
              const isInline = inlineEditId === p.id;
              const inv = inventory.find((i) => i.productId === p.id);
              const stockOnHand = inv ? inv.quantityOnHand : 0;
              const reorderThreshold = p.reorderLevel ?? 5;
              const isLow = stockOnHand <= reorderThreshold;
              const isOut = stockOnHand === 0;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-3xl bg-[#121824] border transition-all space-y-3 ${
                    p.isArchived
                      ? 'border-amber-900/50 bg-[#121824]/60 opacity-80'
                      : isLow
                      ? 'border-amber-900/60 hover:border-amber-700 shadow-md shadow-amber-950/20'
                      : 'border-[#1E293B] hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-white truncate">
                          {p.name}
                        </span>
                        {p.isMeasured && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700/60 flex items-center gap-1 shrink-0">
                            <Scale className="w-3 h-3 text-cyan-300" />
                            <span>Measured</span>
                          </span>
                        )}
                        {p.isArchived && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-800">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                        <span className="capitalize">{p.category.replace('_', ' ').toLowerCase()}</span>
                        <span>·</span>
                        <span>
                          {p.isMeasured
                            ? p.measurementType === 'VALUE' || p.unit === 'VALUE_KES'
                              ? 'Value (KES)'
                              : (p.measureUnitLabel || p.unit.toLowerCase())
                            : p.unit.toLowerCase()}
                        </span>
                        {p.volumeMl && !p.isMeasured && (
                          <>
                            <span>·</span>
                            <span>{p.volumeMl}ml</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!p.isArchived ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Full Edit Details"
                            className="p-2 rounded-xl bg-[#0E1420] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProduct(p)}
                            title="Archive or Delete"
                            className="p-2 rounded-xl bg-[#0E1420] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleRestore(p.id)}
                          className="py-1.5 px-2.5 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-400 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock Audit Section: Direct Editable Input + Status Badge */}
                  <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">
                        Stock on Hand (Audit)
                      </span>
                      <span
                        className={`text-[10px] font-sans px-2 py-0.5 rounded font-bold ${
                          isOut
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : isLow
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isLow ? 'Restock Needed' : 'Adequate'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStockStep(p.id, stockOnHand, -1)}
                          disabled={p.isArchived || stockOnHand <= 0}
                          className="w-7 h-7 rounded-lg bg-[#151D2C] hover:bg-slate-800 disabled:opacity-40 text-slate-300 flex items-center justify-center border border-slate-700 cursor-pointer"
                          title="Decrease stock count by 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          step="any"
                          min="0"
                          disabled={p.isArchived}
                          value={stockInputs[p.id] !== undefined ? stockInputs[p.id] : stockOnHand}
                          onChange={(e) => handleStockChange(p.id, e.target.value)}
                          onBlur={() => handleStockCommit(p.id, stockOnHand)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`w-20 px-2 py-1 bg-[#151D2C] text-center font-mono font-bold text-sm rounded-lg border outline-none ${
                            isOut
                              ? 'text-red-400 border-red-800 focus:border-red-500'
                              : isLow
                              ? 'text-amber-400 border-amber-800 focus:border-amber-500'
                              : 'text-emerald-300 border-slate-700 focus:border-emerald-500'
                          }`}
                          title="Type stock number (e.g. 9.5 for half bottle) and tap outside or press Enter to save"
                        />

                        <button
                          type="button"
                          onClick={() => handleStockStep(p.id, stockOnHand, 1)}
                          disabled={p.isArchived}
                          className="w-7 h-7 rounded-lg bg-[#151D2C] hover:bg-slate-800 disabled:opacity-40 text-slate-300 flex items-center justify-center border border-slate-700 cursor-pointer"
                          title="Increase stock count by 1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono text-right">
                        <span>Reorder alert at: </span>
                        <span className="text-white font-bold">{reorderThreshold}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Matrix */}
                  {!p.isMeasured ? (
                    !isInline ? (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-slate-500 uppercase font-sans">
                            Selling Price
                          </div>
                          <div className="text-emerald-400 font-black text-sm">
                            KES {p.sellingPrice.toLocaleString()}
                          </div>
                        </div>

                        {!p.isArchived && (
                          <button
                            onClick={() => {
                              setInlineEditId(p.id);
                              setInlineSell(String(p.sellingPrice));
                            }}
                            className="py-1 px-2.5 rounded-lg bg-[#0E1420] hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                          >
                            Quick Price
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Inline Price Editor */
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 block font-sans">Selling Price (KES)</span>
                          <input
                            type="number"
                            value={inlineSell}
                            onChange={(e) => setInlineSell(e.target.value)}
                            className="w-full bg-[#0E1420] border border-emerald-500 rounded-xl px-2 py-1.5 text-white font-bold"
                          />
                        </div>
                        <div className="flex items-center gap-1 pt-4">
                          <button
                            onClick={() => handleSaveInline(p.id)}
                            className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setInlineEditId(null)}
                            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-cyan-400 uppercase font-sans font-semibold flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          <span>Direct Value Tracking</span>
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Counter stock value directly represents selling worth
                        </div>
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
 Initial Stock on Hand
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

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
 Volume in ml (Optional)
 </label>
 <input
 type="number"
 min="1"
 value={volumeMl}
 onChange={(e) => setVolumeMl(e.target.value)}
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
 <span>{editingProduct ? 'Save Drink Changes' : 'Add Drink to Catalog'}</span>
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

 {/* 5. MODAL: BULK PASTE REAL DRINKS */}
 {/* 5. MODAL: ADD / EDIT MEASURED DRINK (VALUE-BASED) */}
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
 Continuous drink measured by value (e.g. Makali, Muratina, local brew)
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
       Quick Staples
     </label>
     <div className="flex flex-wrap gap-1.5">
       {[
         { name: 'Makali', price: '1500' },
         { name: 'Muratina', price: '1500' },
         { name: 'Busaa / Local Brew', price: '1200' },
         { name: 'Keg Draught', price: '2000' },
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
       ))}
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
 <option value="TRADITIONAL_BREW">Traditional Brew & Continuous</option>
 <option value="BEER">Beer / Keg Draft</option>
 <option value="WINE">Wine (Carafe / Dispenser)</option>
 <option value="SPIRIT">Spirit / Whiskey Dispenser</option>
 <option value="SOFT_DRINK">Soft Drink / Juice</option>
 </select>
 </div>

 {/* Stock & Valuation (Pure Value Measurement - Value IS Selling Price) */}
 <div className="space-y-3 p-3.5 rounded-2xl bg-[#0E1420] border border-cyan-900/60">
   <div>
     <div className="flex items-center justify-between mb-1">
       <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
         <Scale className="w-3.5 h-3.5 text-cyan-400" />
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
       placeholder="e.g. 1500"
     />
     <span className="text-[10px] text-slate-400 mt-1 block">
       Total KES worth of drink currently remaining on the counter. Value directly equals selling price.
     </span>
   </div>
 </div>


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
 </div>
 );
};
