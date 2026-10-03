import React, { useState } from 'react';
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
} from 'lucide-react';

export const CatalogManager: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Bulk Import & Clean Slate States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);
  const [defaultBulkStock, setDefaultBulkStock] = useState('0');
  const [showWipeConfirmModal, setShowWipeConfirmModal] = useState(false);

  // Form State for Add / Edit
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('BEER');
  const [unit, setUnit] = useState<ProductUnit>('BOTTLE');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [initialStock, setInitialStock] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Inline Price Editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineCost, setInlineCost] = useState('');
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

    return matchesSearch && matchesCat;
  });

  const activeProducts = allProducts.filter((p) => !p.isArchived);
  const archivedProducts = allProducts.filter((p) => p.isArchived);

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
  ];

  // Open Add Modal
  const handleOpenAdd = () => {
    setName('');
    setCategory('BEER');
    setUnit('BOTTLE');
    setCostPrice('');
    setSellingPrice('');
    setReorderLevel('5');
    setInitialStock('');
    setVolumeMl('');
    setFormError(null);
    setEditingProduct(null);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setUnit(p.unit);
    setCostPrice(String(p.costPrice));
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

    const cost = parseFloat(costPrice);
    const sell = parseFloat(sellingPrice);
    const reorder = parseInt(reorderLevel, 10) || 5;
    const stock = parseInt(initialStock, 10) || 0;
    const vol = volumeMl ? parseInt(volumeMl, 10) : undefined;

    if (!name.trim()) {
      setFormError('Please enter a drink name.');
      return;
    }

    if (isNaN(cost) || cost < 0) {
      setFormError('Please enter a valid wholesale cost price.');
      return;
    }

    if (isNaN(sell) || sell <= 0) {
      setFormError('Please enter a valid retail selling price.');
      return;
    }

    if (sell < cost) {
      setFormError('Selling price cannot be less than wholesale cost price.');
      return;
    }

    if (editingProduct) {
      // Updating existing product
      store.updateProduct(editingProduct.id, {
        name: name.trim(),
        category,
        unit,
        costPrice: cost,
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
        costPrice: cost,
        sellingPrice: sell,
        reorderLevel: reorder,
        volumeMl: vol,
        initialStock: stock,
      });
    }

    setShowAddModal(false);
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
    const cost = parseFloat(inlineCost);
    const sell = parseFloat(inlineSell);
    if (!isNaN(cost) && !isNaN(sell) && sell >= 0 && cost >= 0) {
      store.updateProductPricing(productId, sell, cost);
    }
    setInlineEditId(null);
  };

  // Bulk import parser: parses lines of "Name, Price, Cost, Category, Stock" or "Name, Price"
  const parseBulkLines = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((line, idx) => {
      const parts = line.includes(',')
        ? line.split(',').map((p) => p.trim())
        : line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.includes(' - ')
        ? line.split(' - ').map((p) => p.trim())
        : line.split(':').map((p) => p.trim());

      const rawName = parts[0] || `Drink ${idx + 1}`;
      const rawSell = parts[1] ? parseFloat(parts[1].replace(/[^0-9.]/g, '')) : 0;
      const rawCost = parts[2] ? parseFloat(parts[2].replace(/[^0-9.]/g, '')) : undefined;
      const rawCat = parts[3]?.toUpperCase();
      const rawStock = parts[4] ? parseInt(parts[4].replace(/[^0-9]/g, ''), 10) : undefined;

      // Smart category detection from drink keywords
      let guessedCat: ProductCategory = 'BEER';
      const lower = rawName.toLowerCase();
      if (
        lower.includes('whisky') ||
        lower.includes('whiskey') ||
        lower.includes('gin') ||
        lower.includes('vodka') ||
        lower.includes('rum') ||
        lower.includes('brandy') ||
        lower.includes('cognac') ||
        lower.includes('tequila') ||
        lower.includes('liqueur') ||
        lower.includes('spirit') ||
        lower.includes('jameson') ||
        lower.includes('gilbeys') ||
        lower.includes('johnnie') ||
        lower.includes('black label') ||
        lower.includes('red label') ||
        lower.includes('flagon') ||
        lower.includes('richot') ||
        lower.includes('viceroy') ||
        lower.includes('captain morgan') ||
        lower.includes('jack daniel')
      ) {
        guessedCat = 'SPIRIT';
      } else if (lower.includes('cider') || lower.includes('savanna') || lower.includes('hunters') || lower.includes('snapp')) {
        guessedCat = 'CIDER';
      } else if (lower.includes('wine') || lower.includes('sauvignon') || lower.includes('merlot') || lower.includes('chardonnay') || lower.includes('cabernet') || lower.includes('cellar cask') || lower.includes('4th street')) {
        guessedCat = 'WINE';
      } else if (lower.includes('soda') || lower.includes('coca') || lower.includes('coke') || lower.includes('fanta') || lower.includes('sprite') || lower.includes('water') || lower.includes('juice') || lower.includes('red bull') || lower.includes('energy') || lower.includes('tonic') || lower.includes('ginger ale') || lower.includes('krest')) {
        guessedCat = 'SOFT_DRINK';
      } else if (lower.includes('smoke') || lower.includes('cigarette') || lower.includes('dunhill') || lower.includes('sportsman') || lower.includes('embassy')) {
        guessedCat = 'CIGARETTE';
      }

      const validCats: ProductCategory[] = ['BEER', 'CIDER', 'SPIRIT', 'WINE', 'SOFT_DRINK', 'CIGARETTE'];
      const category: ProductCategory = validCats.includes(rawCat as ProductCategory) ? (rawCat as ProductCategory) : guessedCat;

      const sellingPrice = isNaN(rawSell) ? 0 : rawSell;
      const costPrice = rawCost !== undefined && !isNaN(rawCost) ? rawCost : Math.round(sellingPrice * 0.75);
      const stock = rawStock !== undefined && !isNaN(rawStock) ? rawStock : parseInt(defaultBulkStock, 10) || 0;

      return {
        name: rawName,
        sellingPrice,
        costPrice,
        category,
        unit: ('BOTTLE' as ProductUnit),
        initialStock: stock,
        reorderLevel: 5,
      };
    });
  };

  const handleBulkImport = () => {
    const parsed = parseBulkLines(bulkText).filter((p) => p.name.trim().length > 0 && p.sellingPrice > 0);
    if (parsed.length === 0) {
      setFormError('Please enter at least one drink with a valid name and price.');
      return;
    }

    const added = store.bulkAddProducts(parsed);
    setBulkSuccessMsg(`Successfully imported ${added.length} real drinks into your catalog!`);
    setTimeout(() => {
      setShowBulkModal(false);
      setBulkText('');
      setBulkSuccessMsg(null);
    }, 1200);
  };

  const handleWipeTestData = () => {
    store.clearAllProducts();
    setShowWipeConfirmModal(false);
  };

  const handleRestoreTemplate = () => {
    store.restoreDefaultCatalog();
  };

  // Calculated margin for Add/Edit Modal preview
  const numCost = parseFloat(costPrice) || 0;
  const numSell = parseFloat(sellingPrice) || 0;
  const projectedMargin = numSell - numCost;
  const projectedPct = numSell > 0 ? Math.round((projectedMargin / numSell) * 100) : 0;

  const parsedBulkPreview = parseBulkLines(bulkText);

  return (
    <div className="space-y-4">
      {/* 1. Header & Catalog Controls */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
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
              Add new drinks, set wholesale costs & selling prices, or bulk import real inventory.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="py-2.5 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Bulk Paste Real Drinks</span>
            </button>

            {allProducts.length > 0 && (
              <button
                onClick={() => setShowWipeConfirmModal(true)}
                className="py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-950/70 border border-red-800/60 text-red-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Wipe sample drinks to start with clean real data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Wipe Sample Drinks</span>
              </button>
            )}

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showArchived
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-[#0E1420] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'View Active Drinks' : `Archived (${archivedProducts.length})`}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Drink</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drinks by name or category..."
              className="w-full bg-[#0E1420] border border-slate-800 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
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

      {/* 2. Drink Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full p-8 sm:p-12 text-center rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {allProducts.length === 0 ? 'Clean Slate Active — Ready for Your Real Drinks' : 'No Drinks Found'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {allProducts.length === 0
                  ? 'Your menu is empty with zero test data. Paste your real price list or add drinks individually so attendants can begin recording shift sales.'
                  : showArchived
                  ? 'No archived drinks in this category.'
                  : 'No drinks match your search filter.'}
              </p>
            </div>
            {allProducts.length === 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <FileText className="w-4 h-4" />
                  <span>Bulk Paste Real Drinks & Prices</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#151D2C] hover:bg-[#1E293B] border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Add Single Drink</span>
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
          filteredProducts.map((p) => {
            const isInline = inlineEditId === p.id;
            const inv = inventory.find((i) => i.productId === p.id);
            const stockOnHand = inv ? inv.quantityOnHand : 0;
            const margin = p.sellingPrice - p.costPrice;
            const marginPct = p.sellingPrice > 0 ? Math.round((margin / p.sellingPrice) * 100) : 0;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-3xl bg-[#121824] border transition-all ${
                  p.isArchived
                    ? 'border-amber-900/50 bg-[#121824]/60 opacity-80'
                    : 'border-[#1E293B] hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-white truncate">
                        {p.name}
                      </span>
                      {p.isArchived && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <span className="capitalize">{p.category.replace('_', ' ').toLowerCase()}</span>
                      <span>·</span>
                      <span>{p.unit.toLowerCase()}</span>
                      {p.volumeMl && (
                        <>
                          <span>·</span>
                          <span>{p.volumeMl}ml</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="text-emerald-400 font-semibold">{stockOnHand} on shelf</span>
                    </div>
                  </div>

                  {/* Actions Dropdown / Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!p.isArchived ? (
                      <>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          title="Full Edit"
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

                {/* Price & Margin Matrix */}
                {!isInline ? (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Wholesale Cost</div>
                      <div className="text-slate-300 font-semibold">KES {p.costPrice.toLocaleString()}</div>
                    </div>

                    <div className="space-y-0.5 text-center">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Selling Price</div>
                      <div className="text-emerald-400 font-black text-sm">KES {p.sellingPrice.toLocaleString()}</div>
                    </div>

                    <div className="space-y-0.5 text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Gross Margin</div>
                      <div className="text-emerald-400 font-bold">
                        +{marginPct}% <span className="text-[11px] text-slate-400 font-normal">({margin} KES)</span>
                      </div>
                    </div>

                    {!p.isArchived && (
                      <button
                        onClick={() => {
                          setInlineEditId(p.id);
                          setInlineCost(String(p.costPrice));
                          setInlineSell(String(p.sellingPrice));
                        }}
                        className="ml-2 py-1 px-2.5 rounded-lg bg-[#0E1420] hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                      >
                        Quick Price
                      </button>
                    )}
                  </div>
                ) : (
                  /* Inline Price Editor */
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400 block font-sans">Cost (KES)</span>
                      <input
                        type="number"
                        value={inlineCost}
                        onChange={(e) => setInlineCost(e.target.value)}
                        className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-2 py-1.5 text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400 block font-sans">Sell (KES)</span>
                      <input
                        type="number"
                        value={inlineSell}
                        onChange={(e) => setInlineSell(e.target.value)}
                        className="w-full bg-[#0E1420] border border-emerald-500 rounded-xl px-2 py-1.5 text-emerald-400 font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1 pt-3.5">
                      <button
                        onClick={() => handleSaveInline(p.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setInlineEditId(null)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
                  placeholder="e.g. Tusker Malt 330ml or Gilbeys Gin 750ml"
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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

              {/* Wholesale Cost & Retail Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Wholesale Cost (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      KES
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="e.g. 190"
                      className="w-full bg-[#0E1420] border border-slate-700 rounded-xl pl-12 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

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
                      placeholder="e.g. 260"
                      className="w-full bg-[#0E1420] border border-emerald-500/80 rounded-xl pl-12 pr-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Projected Profit Margin Card */}
              {numSell > 0 && (
                <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs flex items-center justify-between font-mono">
                  <div className="text-slate-400">Projected Margin per Unit:</div>
                  <div className="text-emerald-400 font-bold">
                    KES {projectedMargin.toLocaleString()} (+{projectedPct}%)
                  </div>
                </div>
              )}

              {/* Initial Stock & Reorder Alert Level */}
              <div className="grid grid-cols-2 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Initial Stock on Hand
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      placeholder="e.g. 24"
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
                    min="1"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="e.g. 5 (Default)"
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
                    placeholder="e.g. 500"
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
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Bulk Import Real Products & Prices
                  </h3>
                  <p className="text-xs text-slate-400">
                    Paste your list of drinks directly from text, WhatsApp, or Excel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setFormError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{bulkSuccessMsg}</span>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Flexible Format Examples (One Drink Per Line):</span>
                </div>
                <div className="font-mono text-slate-400 space-y-0.5 pl-1 text-[10px]">
                  <div>Tusker Lager, 250</div>
                  <div>White Cap, 260, 190 (Name, Selling Price, Cost Price)</div>
                  <div>Guinness Foreign Extra: 300</div>
                  <div>Gilbeys Gin 750ml, 1600, 1200, SPIRIT, 12 (with initial stock)</div>
                  <div>Jameson 750ml - 2800</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Paste Your Products & Prices List *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkText(
                        `Tusker Lager 500ml, 250\nWhite Cap Crisp 500ml, 260, 190\nGuinness Foreign Extra 500ml, 300\nTusker Cider 500ml, 280\nGilbeys Gin 750ml, 1600, 1200\nJameson Irish Whiskey 750ml, 2800, 2200\nJohnnie Walker Black Label 750ml, 3800\nCoca Cola 300ml, 80, 50\nWater 500ml, 60, 30`
                      );
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono underline cursor-pointer"
                  >
                    Paste Kenyan Bar Sample Format
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={bulkText}
                  onChange={(e) => {
                    setBulkText(e.target.value);
                    setFormError(null);
                  }}
                  placeholder={`Tusker Lager, 250\nWhite Cap, 260\nGuinness 500ml, 300\nGilbeys Gin 750ml, 1600\nJameson 750ml, 2800, 2200`}
                  className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl p-3.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Default Initial Stock (per drink)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={defaultBulkStock}
                    onChange={(e) => setDefaultBulkStock(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#0E1420] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Leave 0 if physical stock will be counted during shift opening.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0E1420] border border-slate-800 flex flex-col justify-center">
                  <div className="text-[10px] text-slate-400">Live Parser Summary</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {parsedBulkPreview.filter((p) => p.name.trim() && p.sellingPrice > 0).length} drink(s) detected
                  </div>
                </div>
              </div>

              {/* Live Preview List */}
              {parsedBulkPreview.length > 0 && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="bg-[#0E1420] px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Preview ({parsedBulkPreview.filter((p) => p.name.trim() && p.sellingPrice > 0).length} ready)
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                    {parsedBulkPreview
                      .filter((p) => p.name.trim())
                      .map((p, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between bg-[#121824]">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-300 font-medium truncate">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 uppercase">
                              {p.category}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-emerald-400">KES {p.sellingPrice}</span>
                            {p.costPrice !== undefined && (
                              <span className="text-[10px] text-slate-500 ml-1.5">
                                (Cost: KES {p.costPrice})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setFormError(null);
                }}
                className="py-3 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={parsedBulkPreview.filter((p) => p.name.trim() && p.sellingPrice > 0).length === 0}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  Import {parsedBulkPreview.filter((p) => p.name.trim() && p.sellingPrice > 0).length} Drinks to Menu
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: WIPE TEST / SAMPLE DATA CONFIRMATION */}
      {showWipeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#121824] border border-red-900/50 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Wipe Sample / Test Drinks?
                </h3>
                <p className="text-xs text-red-300">
                  Reset catalog to a 100% clean slate
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will remove all {allProducts.length} sample/test drinks for this establishment so you can enter or paste your real products and prices right away.
            </p>

            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>What remains intact:</span>
              </div>
              <p>Your business establishment profile, staff accounts, and financial accounts will NOT be deleted.</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWipeConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl bg-[#0E1420] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Keep Existing
              </button>
              <button
                type="button"
                onClick={handleWipeTestData}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Wipe Test Drinks</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
