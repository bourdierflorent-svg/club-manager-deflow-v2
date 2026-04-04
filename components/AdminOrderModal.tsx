import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../store/index';
import { Product, OrderItem, Client } from '../src/types';
import { generateShortId } from '../src/utils';
import { 
  X, ChevronRight, ChevronLeft, Edit3, ShoppingCart, Trash2, CheckCircle2 
} from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

interface AdminOrderModalProps {
  client: Client;
  onClose: () => void;
  onSuccess?: () => void;
}

type OrderStep = 'category' | 'product' | 'configure' | 'manual';
type BottleSize = 'standard' | 'magnum' | 'jeroboam' | 'mathusalem';

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const AdminOrderModal: React.FC<AdminOrderModalProps> = ({ client, onClose, onSuccess }) => {
  const { products, createOrder, currentUser, addNotification } = useStore();
  
  // Toggle mobile Menu/Panier
  const [mobileView, setMobileView] = useState<'menu' | 'basket'>('menu');

  // États du formulaire
  const [orderStep, setOrderStep] = useState<OrderStep>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<BottleSize>('standard');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Données dérivées
  const categories = useMemo(() => 
    Array.from(new Set(products.map(p => p.category))), 
    [products]
  );
  
  const filteredProducts = useMemo(() => 
    products.filter(p => p.category === selectedCategory), 
    [products, selectedCategory]
  );

  const orderTotal = useMemo(() => 
    currentOrderItems.reduce((acc, i) => acc + i.subtotal, 0),
    [currentOrderItems]
  );

  // Actions
  const resetOrderForm = useCallback(() => {
    setOrderStep('category');
    setSelectedCategory('');
    setSelectedProduct(null);
    setSelectedSize('standard');
    setItemQuantity(1);
    setManualName('');
    setManualPrice('');
  }, []);

  const handleAddItemToBasket = useCallback(() => {
    if (!selectedProduct) return;
    const price = selectedProduct.prices[selectedSize];
    if (!price) return;
    
    const newItem: OrderItem = {
      id: generateShortId('item'),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: selectedSize,
      quantity: itemQuantity,
      unitPrice: price,
      subtotal: price * itemQuantity
    };
    setCurrentOrderItems(prev => [...prev, newItem]);
    resetOrderForm();
  }, [selectedProduct, selectedSize, itemQuantity, resetOrderForm]);

  const handleAddManualItem = useCallback(() => {
    if (!manualName || !manualPrice) return;
    const priceNum = parseFloat(manualPrice);
    if (isNaN(priceNum)) return;

    const newItem: OrderItem = {
      id: generateShortId('manual'),
      productId: 'manual-divers',
      productName: manualName.toUpperCase(),
      size: 'standard',
      quantity: 1,
      unitPrice: priceNum,
      subtotal: priceNum
    };
    setCurrentOrderItems(prev => [...prev, newItem]);
    resetOrderForm();
  }, [manualName, manualPrice, resetOrderForm]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setCurrentOrderItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const handleSendOrder = useCallback(() => {
    if (!client || currentOrderItems.length === 0 || !currentUser || isSubmitting) return;
    setIsSubmitting(true);
    const waiterId = client.waiterId || currentUser.id;

    if (client.tableId) {
      createOrder(client.id, client.tableId, waiterId, currentOrderItems, orderNote);
      addNotification({
        type: 'success',
        title: 'COMMANDE ENVOYÉE',
        message: `Commande pour ${client.name} transmise.`
      });
    }
    onClose();
  }, [client, currentOrderItems, currentUser, orderNote, createOrder, addNotification, onClose, isSubmitting]);

  return (
    <div className="fixed inset-0 z-[600] bg-zinc-900 flex flex-col md:flex-row h-full overflow-hidden animate-in fade-in duration-300">

      {/* TOGGLE MOBILE Menu/Panier */}
      <div className="md:hidden bg-zinc-950 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-tighter truncate flex-1">
            {client.name}
          </h3>
          <button onClick={onClose} className="bg-zinc-800 p-2 rounded-full text-white active:scale-90 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setMobileView('menu')}
            className={`flex-1 py-3 rounded-xl font-semibold uppercase text-xs transition-all ${mobileView === 'menu' ? 'bg-white text-black' : 'bg-zinc-800/50 text-zinc-500'}`}
          >
            Menu
          </button>
          <button
            onClick={() => setMobileView('basket')}
            className={`flex-1 py-3 rounded-xl font-semibold uppercase text-xs transition-all relative ${mobileView === 'basket' ? 'bg-white text-black' : 'bg-zinc-800/50 text-zinc-500'}`}
          >
            Panier {currentOrderItems.length > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${mobileView === 'basket' ? 'bg-black text-white' : 'bg-emerald-500 text-white'}`}>{currentOrderItems.length}</span>}
          </button>
        </div>
      </div>

      {/* COLONNE GAUCHE: SÉLECTION */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden md:border-r border-zinc-800 relative ${mobileView !== 'menu' ? 'hidden md:flex' : 'flex'}`}>
        <div className="hidden md:flex bg-zinc-950 p-6 border-b border-zinc-800 items-center justify-between shrink-0">
          <h3 className="text-xl font-semibold text-white uppercase tracking-tighter">
            Commande pour {client.name}
          </h3>
          <button onClick={onClose} className="bg-zinc-800 p-4 rounded-full text-white active:scale-90">
            <X />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar pb-32">
          
          {/* Étape: Catégories */}
          {orderStep === 'category' && (
            <div className="grid grid-cols-2 gap-3 pt-4">
              {categories.map((cat) => (
                <button 
                  key={cat} 
                  onClick={() => { setSelectedCategory(cat); setOrderStep('product'); }} 
                  className="aspect-square bg-zinc-800 border-2 border-zinc-800/50 rounded-xl p-4 flex flex-col items-center justify-center font-semibold text-lg text-white uppercase active:bg-white active:text-black shadow-2xl transition-all text-center leading-tight hover:border-zinc-700"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          
          {/* Étape: Produits */}
          {orderStep === 'product' && (
            <div className="space-y-3 pt-4">
              <button 
                onClick={() => setOrderStep('category')} 
                className="text-zinc-400 font-semibold text-xs uppercase flex items-center gap-2 mb-4"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              
              {selectedCategory === 'DIVERS' && (
                <button 
                  onClick={() => setOrderStep('manual')} 
                  className="w-full bg-indigo-600 text-white py-8 px-8 rounded-xl font-semibold text-2xl uppercase flex items-center justify-between shadow-xl mb-4"
                >
                  Saisie Manuelle <Edit3 className="w-6 h-6" />
                </button>
              )}
              
              {filteredProducts.map(prod => (
                <button 
                  key={prod.id} 
                  onClick={() => { setSelectedProduct(prod); setOrderStep('configure'); }} 
                  className="w-full bg-zinc-800 border-2 border-zinc-800/50 py-8 px-8 rounded-xl font-semibold text-2xl text-white uppercase flex items-center justify-between active:border-white shadow-xl hover:bg-zinc-800/50"
                >
                  {prod.name} <ChevronRight className="w-6 h-6 text-zinc-400/30" />
                </button>
              ))}
            </div>
          )}
          
          {/* Étape: Saisie manuelle */}
          {orderStep === 'manual' && (
            <div className="space-y-8 pt-4">
              <button 
                onClick={() => setOrderStep('product')} 
                className="text-zinc-400 font-semibold text-xs uppercase flex items-center gap-2 mb-4"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              
              <div className="space-y-4">
                <input 
                  placeholder="NOM ARTICLE" 
                  value={manualName} 
                  onChange={e => setManualName(e.target.value.toUpperCase())} 
                  className="w-full bg-zinc-800 border-4 border-zinc-800/50 py-6 px-8 rounded-xl text-white font-semibold text-xl uppercase outline-none focus:border-white" 
                />
                <input 
                  type="number" 
                  placeholder="PRIX (€)" 
                  value={manualPrice} 
                  onChange={e => setManualPrice(e.target.value)} 
                  className="w-full bg-zinc-800 border-4 border-zinc-800/50 py-6 px-8 rounded-xl text-white font-semibold text-3xl outline-none focus:border-white" 
                />
              </div>
              
              <button 
                onClick={handleAddManualItem} 
                disabled={!manualName || !manualPrice} 
                className="w-full bg-white text-black py-8 rounded-xl font-semibold text-2xl uppercase shadow-2xl disabled:opacity-30 transition-all"
              >
                Ajouter
              </button>
            </div>
          )}
          
          {/* Étape: Configuration */}
          {orderStep === 'configure' && selectedProduct && (
            <div className="space-y-8 pt-4">
              <button 
                onClick={() => setOrderStep('product')} 
                className="text-zinc-400 font-semibold text-xs uppercase flex items-center gap-2 mb-4"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              
              <div className="text-center">
                <h4 className="text-4xl font-semibold text-white uppercase mb-1 tracking-tighter">
                  {selectedProduct.name}
                </h4>
                <p className="text-zinc-400 font-semibold uppercase text-[10px] tracking-[0.2em]">
                  {selectedCategory}
                </p>
              </div>
              
              <div className="flex flex-col items-center gap-6 bg-zinc-950 p-6 rounded-xl border border-zinc-800/50">
                <div className="flex items-center gap-8">
                  <button 
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} 
                    className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-white text-3xl font-semibold active:scale-90 transition-transform"
                  >
                    -
                  </button>
                  <span className="text-6xl font-semibold text-white tracking-tighter">{itemQuantity}</span>
                  <button 
                    onClick={() => setItemQuantity(itemQuantity + 1)} 
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black text-3xl font-semibold active:scale-90 transition-transform"
                  >
                    +
                  </button>
                </div>
                
                <button 
                  onClick={handleAddItemToBasket} 
                  className="w-full bg-white text-black py-6 rounded-xl font-semibold text-2xl uppercase shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <ShoppingCart className="w-6 h-6" /> Ajouter au Panier
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedProduct.prices).map(([size, price]) => {
                  if (!price) return null;
                  return (
                    <button 
                      key={size} 
                      onClick={() => setSelectedSize(size as BottleSize)} 
                      className={`py-6 rounded-xl flex flex-col items-center border-4 transition-all ${
                        selectedSize === size 
                          ? 'bg-white border-zinc-800 text-black scale-[1.02] shadow-xl' 
                          : 'bg-zinc-800 border-transparent text-zinc-600'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase mb-1">{size}</span>
                      <span className="text-xl font-semibold">{price}€</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COLONNE DROITE: PANIER */}
      <div className={`w-full md:w-1/3 bg-zinc-950 flex flex-col h-full md:border-l border-zinc-800 shadow-2xl ${mobileView !== 'basket' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-zinc-800 bg-zinc-950">
          <h5 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Commande en cours
          </h5>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {currentOrderItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-4">
              <ShoppingCart className="w-16 h-16" />
              <p className="font-semibold uppercase text-xs tracking-widest">Panier vide</p>
            </div>
          ) : (
            currentOrderItems.map(item => (
              <div 
                key={item.id} 
                className="flex items-center justify-between bg-zinc-800/50 p-4 rounded-xl border border-zinc-800/50 animate-in slide-in-from-right-4 duration-300"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white uppercase">
                    {item.quantity}x {item.productName}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-semibold uppercase">
                    {item.size.toUpperCase()} • {item.subtotal}€
                  </p>
                </div>
                <button 
                  onClick={() => handleRemoveItem(item.id)} 
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-zinc-950 border-t border-zinc-800 space-y-4">
          <textarea 
            value={orderNote} 
            onChange={(e) => setOrderNote(e.target.value)} 
            placeholder="NOTE POUR LE BAR / MANAGER..." 
            className="w-full bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-white font-semibold text-xs outline-none uppercase resize-none h-20 placeholder:text-zinc-600" 
          />
          
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase mb-1">TOTAL</span>
            <span className="text-4xl font-semibold text-white">{orderTotal}€</span>
          </div>
          
          <button
            onClick={handleSendOrder}
            disabled={currentOrderItems.length === 0 || isSubmitting}
            className="w-full bg-emerald-600 text-white py-8 rounded-xl font-semibold text-2xl uppercase shadow-2xl active:scale-95 disabled:opacity-20 disabled:grayscale transition-all flex items-center justify-center gap-3"
          >
            <CheckCircle2 className="w-8 h-8" /> {isSubmitting ? 'ENVOYÉ ✓' : 'CONFIRMER'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderModal;
