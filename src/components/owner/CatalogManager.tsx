import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, ProductCategory, ProductUnit, InventoryItem } from '../../types';
import { store } from '../../services/store';
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
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
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
      className={`min-w-[58px] sm:w-16 min-h-[42px] py-1.5 rounded-xl bg-[#0B0F17] border hover:border-emerald-500/50 active:scale-95 transition-all text-xs font-mono font-bold select-none cursor-pointer flex items-center justify-center gap-1.5 ${
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
  const [tick, setTick] = useState(0);
  useEffect(() => {
    return store.subscribe(() => {
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
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Form State for Adding Brand New Drink
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('BEER');
  const [unit, setUnit] = useState<ProductUnit>('BOTTLE');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [initialStock, setInitialStock] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [measurementMode, setMeasurementMode] = useState<import('../../types').MeasurementMode>('STANDARD');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [volumeTotal, setVolumeTotal] = useState('');
  const [fullWeightKg, setFullWeightKg] = useState('');
  const [emptyWeightKg, setEmptyWeightKg] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form State for Dedicated Soft Product Editing
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ProductCategory>('BEER');
  const [editUnit, setEditUnit] = useState<ProductUnit>('BOTTLE');
  const [editBuyingPrice, setEditBuyingPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('5');
  const [editVolumeMl, setEditVolumeMl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Phone back-button integration: close any open product modal on phone back
  useBackHandler(showAddModal, () => setShowAddModal(false), 'catalog-add-modal');
  useBackHandler(Boolean(editingProduct), () => setEditingProduct(null), 'catalog-edit-modal');
  useBackHandler(Boolean(deletingProduct), () => setDeletingProduct(null), 'catalog-delete-modal');
  useBackHandler(Boolean(viewingProduct), () => setViewingProduct(null), 'catalog-view-modal');
  useBackHandler(Boolean(adjustingStockProduct), () => setAdjustingStockProduct(null), 'catalog-adjust-stock-modal');

  // Quick Inline Price Editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineSell, setInlineSell] = useState('');

  const allProducts = useMemo(() => store.getProducts(true), [tick]);
  const inventory = useMemo(() => store.getInventory(), [tick]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach((i) => map.set(i.productId, i));
    return map;
  }, [inventory]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const cleanSearch = searchQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (!showArchived && p.isArchived) return false;
      if (showArchived && !p.isArchived) return false;

      const matchesSearch =
        !cleanSearch ||
        p.name.toLowerCase().includes(cleanSearch) ||
        p.category.toLowerCase().includes(cleanSearch);

      const matchesCat =
        selectedCategory === 'ALL' || p.category === selectedCategory;

      const inv = inventoryMap.get(p.id);
      const stockOnHand = inv ? inv.quantityOnHand : 0;
      const isLow = stockOnHand <= (p.reorderLevel ?? 5);

      const matchesStockFilter = stockStatusFilter === 'ALL' || isLow;

      return matchesSearch && matchesCat && matchesStockFilter;
    });
  }, [allProducts, inventoryMap, showArchived, searchQuery, selectedCategory, stockStatusFilter]);

  const activeProducts = useMemo(() => allProducts.filter((p) => !p.isArchived), [allProducts]);
  void activeProducts;

 // Categories list
 const categories: { key: string; label: string }[] = [
 { key: 'ALL', label: 'All Drinks' },
 { key: 'BEER', label: 'Beers' },
 { key: 'CIDER', label: 'Ciders' },
 { key: 'SPIRIT', label: 'Spirits & Whiskeys' },
 { key: 'WINE', label: 'Wines' },
 { key: 'SOFT_DRINK', label: 'Soft Drinks & Sodas' },
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
 { key: 'CUSTOM', label: 'Custom' },
 ];

 // Open Add Modal
 const handleOpenAdd = () => {
   setName('');
   setCategory('BEER');
   setUnit('BOTTLE');
   setBuyingPrice('');
   setSellingPrice('');
   setReorderLevel('5');
   setInitialStock('');
   setVolumeMl('');
   setMeasurementMode('STANDARD');
   setPricePerUnit('');
   setVolumeTotal('');
   setFullWeightKg('');
   setEmptyWeightKg('');
   setFormError(null);
   setEditingProduct(null);
   setShowAddModal(true);
 };

 // Open Edit Modal
 const handleOpenEdit = (p: Product) => {
   setEditingProduct(p);
   setEditName(p.name);
   setEditCategory(p.category);
   setEditUnit(p.unit);
   setEditBuyingPrice(p.buyingPrice !== undefined ? String(p.buyingPrice) : '');
   setEditSellingPrice(p.sellingPrice !== undefined ? String(p.sellingPrice) : '0');
   setEditReorderLevel(String(p.reorderLevel || 5));
   setEditVolumeMl(p.volumeMl ? String(p.volumeMl) : '');
   setEditError(null);
 };

 // 1. Dedicated Function: Add New Drink to Catalog
 const handleAddProductSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   setFormError(null);

   const sell = parseFloat(sellingPrice);
   const buy = buyingPrice.trim() !== '' ? parseFloat(buyingPrice) : undefined;
   const reorder = parseFloat(reorderLevel) || 5;
   const stock = parseFloat(initialStock) || 0;
   const vol = volumeMl ? parseInt(volumeMl, 10) : undefined;

   if (!name.trim()) {
     setFormError('Please enter a drink name.');
     return;
   }

   if (isNaN(sell) || sell < 0) {
     setFormError('Please enter a valid retail selling price (KES 0 or higher).');
     return;
   }

   if (buy !== undefined && (isNaN(buy) || buy < 0)) {
     setFormError('Please enter a valid wholesale buying cost (KES 0 or higher).');
     return;
   }

   store.addProduct({
     name: name.trim(),
     category,
     unit,
     sellingPrice: sell,
     buyingPrice: buy,
     reorderLevel: reorder,
     volumeMl: vol,
     initialStock: stock,
     measurementMode,
     pricePerUnit: pricePerUnit.trim() !== '' ? parseFloat(pricePerUnit) : undefined,
     volumeTotal: volumeTotal.trim() !== '' ? parseFloat(volumeTotal) : undefined,
     fullWeightKg: fullWeightKg.trim() !== '' ? parseFloat(fullWeightKg) : undefined,
     emptyWeightKg: emptyWeightKg.trim() !== '' ? parseFloat(emptyWeightKg) : undefined,
   });

   setSavedStockNotice(`Added ${name.trim()} to catalog`);
   setTimeout(() => setSavedStockNotice(null), 3500);

   setShowAddModal(false);
 };

 // 2. Dedicated Function: Softly Adjust Existing Product Values
 const handleSaveProductEdit = (e: React.FormEvent) => {
   e.preventDefault();
   if (!editingProduct) return;
   setEditError(null);

   if (!editName.trim()) {
     setEditError('Please enter a drink name.');
     return;
   }

   const sell = editSellingPrice.trim() !== '' ? parseFloat(editSellingPrice) : editingProduct.sellingPrice;
   if (isNaN(sell) || sell < 0) {
     setEditError('Please enter a valid selling price (KES 0 or higher).');
     return;
   }

   const buy = editBuyingPrice.trim() !== '' ? parseFloat(editBuyingPrice) : undefined;
   if (buy !== undefined && (isNaN(buy) || buy < 0)) {
     setEditError('Please enter a valid wholesale buying cost (KES 0 or higher).');
     return;
   }

   const reorder = parseFloat(editReorderLevel) || 5;
   const vol = editVolumeMl ? parseInt(editVolumeMl, 10) : undefined;

   // Softly updates values needed without disrupting stock logs or other fields
   store.updateProduct(editingProduct.id, {
     name: editName.trim(),
     category: editCategory,
     unit: editUnit,
     sellingPrice: sell,
     buyingPrice: buy,
     reorderLevel: reorder,
     volumeMl: vol,
   });

   setSavedStockNotice(`Updated ${editName.trim()} settings (Price: KES ${sell.toLocaleString()})`);
   setTimeout(() => setSavedStockNotice(null), 3500);

   setEditingProduct(null);
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
              className="min-h-[42px] py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Drink</span>
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
                className="w-full min-h-[42px] bg-[#0E1420] border border-slate-800 rounded-2xl pl-9 pr-9 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>


          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
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
              const inv = inventoryMap.get(p.id);
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
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono text-[11px] tabular-nums">
                        <span className="text-muted">
                          Sell KES {p.sellingPrice.toLocaleString()}
                        </span>
                        {p.buyingPrice !== undefined && p.buyingPrice > 0 && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="text-muted">
                              Cost KES {p.buyingPrice.toLocaleString()}
                            </span>
                            {p.sellingPrice > 0 && (
                              <>
                                <span className="text-faint">·</span>
                                <span className="text-brand-strong font-semibold">
                                  {Math.round(((p.sellingPrice - p.buyingPrice) / p.sellingPrice) * 100)}% margin
                                </span>
                              </>
                            )}
                          </>
                        )}
                        <span className="text-faint uppercase">
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
                    <div className="w-10 shrink-0 flex justify-end relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : p.id)}
                        className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
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
                            {/* View Details / View Product */}
                            <button
                              type="button"
                              onClick={() => {
                                setViewingProduct(p);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                            >
                              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>View Product</span>
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

                        {p.volumeMl && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-mono">Bottle Volume</span>
                            <span className="text-slate-200 font-medium">{p.volumeMl} ml</span>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Reorder Alert</span>
                          <span className="text-slate-200 font-medium">≤ {reorderThreshold} units</span>
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

  {/* 3. MODAL: ADD NEW DRINK (Dedicated function) */}
  {showAddModal && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#121824] border-t sm:border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl pb-safe">
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Add New Drink to Catalog</h3>
              <p className="text-[11px] text-slate-400">Register a new beverage or merchandise line item</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            aria-label="Close"
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

        <form onSubmit={handleAddProductSubmit} className="mt-4 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Drink Name & Volume <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Tusker Lager 500ml"
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

          {/* Wholesale Cost & Selling Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Wholesale Cost (KES)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Optional (e.g. 170)"
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-200 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Selling Price (KES) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                placeholder="e.g. 250"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full bg-[#0E1420] border border-emerald-500/80 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
          {buyingPrice.trim() !== '' && sellingPrice.trim() !== '' && parseFloat(sellingPrice) > 0 && (
            <div className="text-xs font-mono text-emerald-400 tabular-nums">
              Est. profit per unit: KES {(parseFloat(sellingPrice) - (parseFloat(buyingPrice) || 0)).toLocaleString()} (
              {Math.round(((parseFloat(sellingPrice) - (parseFloat(buyingPrice) || 0)) / parseFloat(sellingPrice)) * 100)}% margin)
            </div>
          )}

          {/* Measurement Mode & Measured Product Properties */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Measurement Behavior / Engine Type
            </label>
            <select
              value={measurementMode}
              onChange={(e) => setMeasurementMode(e.target.value as any)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="STANDARD">Standard Counted (Bottles / Units)</option>
              <option value="MAKALI">Makali (Packed units with cash value remainder)</option>
              <option value="MURATINA">Muratina (Volume-based litres or cash value)</option>
              <option value="KEG">Keg (Scale weight gross kg minus tare empty)</option>
            </select>
          </div>

          {measurementMode === 'MAKALI' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Price Per Packed Unit (KES)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 450"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
            </div>
          )}

          {measurementMode === 'MURATINA' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Total Volume per Unit (Litres)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 10"
                  value={volumeTotal}
                  onChange={(e) => setVolumeTotal(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Price per Total Volume (KES)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 1200"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {measurementMode === 'KEG' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Full Tank Weight (kg)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 60"
                  value={fullWeightKg}
                  onChange={(e) => setFullWeightKg(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Empty Tank Tare (kg)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 12"
                  value={emptyWeightKg}
                  onChange={(e) => setEmptyWeightKg(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Initial Stock & Reorder Alert Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Starting Stock Count
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Low Stock Alert Level
              </label>
              <input
                type="number"
                step="any"
                min="0"
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
              className="min-h-[44px] py-3 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Add Drink</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* 4. MODAL: EDIT PRODUCT (Dedicated Soft Adjustment Function) */}
  {editingProduct && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#121824] border-t sm:border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 pb-safe">
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto -mt-1 sm:hidden" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Edit Drink Details</h3>
              <p className="text-[11px] text-slate-400">Softly adjust prices, category, or specifications</p>
            </div>
          </div>
          <button
            onClick={() => setEditingProduct(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Live Status Strip */}
        <div className="p-3 bg-[#0E1420] border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Current Shelf Stock</div>
            <div className="text-sm font-bold text-white mt-0.5 font-mono">
              {inventoryMap.get(editingProduct.id)?.quantityOnHand ?? 0}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">{editingProduct.unit.toLowerCase()}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const currentQty = inventoryMap.get(editingProduct.id)?.quantityOnHand ?? 0;
              setAdjustingStockProduct({
                product: editingProduct,
                currentStock: currentQty,
                targetStock: currentQty,
              });
              setEditingProduct(null);
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            Adjust Count
          </button>
        </div>

        {editError && (
          <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{editError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProductEdit} className="space-y-4">
          {/* Drink Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Drink Name
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value as ProductUnit)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {units.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Wholesale Cost & Selling Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Wholesale Cost (KES)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Optional"
                value={editBuyingPrice}
                onChange={(e) => setEditBuyingPrice(e.target.value)}
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Selling Price (KES)
                </label>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={editSellingPrice}
                onChange={(e) => setEditSellingPrice(e.target.value)}
                className="w-full bg-[#0E1420] border border-emerald-500/80 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
          {editBuyingPrice.trim() !== '' && parseFloat(editSellingPrice) > 0 && (
            <div className="text-xs font-mono text-emerald-400 tabular-nums">
              Est. profit per unit: KES {(parseFloat(editSellingPrice) - (parseFloat(editBuyingPrice) || 0)).toLocaleString()} (
              {Math.round(((parseFloat(editSellingPrice) - (parseFloat(editBuyingPrice) || 0)) / parseFloat(editSellingPrice)) * 100)}% margin)
            </div>
          )}

          {/* Low Stock Alert Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Low Stock Alert Level (Units)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={editReorderLevel}
              onChange={(e) => setEditReorderLevel(e.target.value)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="min-h-[44px] py-3 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-950/50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* 4. MODAL: VIEW PRODUCT DETAILS */}
  {viewingProduct && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{viewingProduct.name}</h3>
              <p className="text-[11px] text-slate-400">Drink Information & Specifications</p>
            </div>
          </div>
          <button
            onClick={() => setViewingProduct(null)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-[#0E1420] border border-slate-800 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Retail Price</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono tabular-nums">
              KES {viewingProduct.sellingPrice.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-[#0E1420] border border-slate-800 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Wholesale Cost</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono tabular-nums">
              {viewingProduct.buyingPrice !== undefined && viewingProduct.buyingPrice > 0
                ? `KES ${viewingProduct.buyingPrice.toLocaleString()}`
                : 'Not set'}
            </div>
          </div>

          <div className="p-3 bg-[#0E1420] border border-slate-800 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Stock on Shelf</div>
            <div className="text-sm font-bold text-white mt-0.5 font-mono tabular-nums">
              {inventoryMap.get(viewingProduct.id)?.quantityOnHand ?? 0}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">{viewingProduct.unit.toLowerCase()}</span>
            </div>
          </div>

          <div className="p-3 bg-[#0E1420] border border-slate-800 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Category</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5 truncate">
              {viewingProduct.category.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Detailed Specs List */}
        <div className="p-3.5 bg-[#0E1420] border border-slate-800/80 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Serving Unit</span>
            <span className="font-semibold text-slate-200 uppercase">{viewingProduct.unit}</span>
          </div>
          {viewingProduct.volumeMl && (
            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-400">Volume</span>
              <span className="font-semibold text-slate-200">{viewingProduct.volumeMl} ml</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Low Stock Reorder Alert</span>
            <span className="font-semibold text-amber-400 font-mono">
              Below {viewingProduct.reorderLevel || 5} units
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400">Status</span>
            <span className={`font-semibold font-mono ${viewingProduct.isArchived ? 'text-amber-400' : 'text-emerald-400'}`}>
              {viewingProduct.isArchived ? 'Archived' : 'Active on Counter'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setViewingProduct(null)}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
          {!viewingProduct.isArchived && (
            <button
              type="button"
              onClick={() => {
                const prod = viewingProduct;
                setViewingProduct(null);
                handleOpenEdit(prod);
              }}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit Details</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )}

  {/* 5. MODAL: CONFIRM ARCHIVE / DELETE */}
 {deletingProduct && (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
 <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#121824] border-t sm:border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 pb-safe">
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

 <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
 <button
 type="button"
 onClick={() => setDeletingProduct(null)}
 className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
 >
 Cancel
 </button>

 <button
 type="button"
 onClick={() => handleConfirmArchiveOrDelete(false)}
 className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
 >
 <Archive className="w-3.5 h-3.5 shrink-0" />
 <span>Archive Drink</span>
 </button>

 <button
 type="button"
 onClick={() => handleConfirmArchiveOrDelete(true)}
 className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
 >
 <span>Delete</span>
 </button>
 </div>
 </div>
 </div>
 )}

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
