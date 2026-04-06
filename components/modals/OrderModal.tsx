/**
 * 📁 components/modals/OrderModal.tsx
 * Modal complet de création de commande
 * 
 * Utilise useOrderBasket et useOrderForm pour la gestion d'état
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Client, Product } from '../../src/types';
import { useOrderBasket, useOrderForm } from '../../src/hooks/useOrderActions';
import { BottleSize } from '../../src/utils';
import { X, ChevronLeft, Plus, Minus, Send, ShoppingCart, Trash2 } from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

interface OrderModalProps {
  isOpen: boolean;
  client: Client | null;
  products: Product[];
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================
// 🧩 SOUS-COMPOSANT: CategoryButton
// ============================================

interface CategoryButtonProps {
  category: string;
  onClick: (category: string) => void;
}

const CategoryButton: React.FC<CategoryButtonProps> = memo(({ category, onClick }) => {
  const handleClick = useCallback(() => onClick(category), [onClick, category]);
  
  return (
    <button
      onClick={handleClick}
      className="p-6 rounded-lg bg-zinc-800 border border-zinc-800 text-white font-medium uppercase hover:bg-zinc-700 transition-all active:scale-95"
    >
      {category}
    </button>
  );
});

CategoryButton.displayName = 'CategoryButton';

// ============================================
// 🧩 SOUS-COMPOSANT: ProductButton
// ============================================

interface ProductButtonProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductButton: React.FC<ProductButtonProps> = memo(({ product, onClick }) => {
  const handleClick = useCallback(() => onClick(product), [onClick, product]);
  
  return (
    <button
      onClick={handleClick}
      className="p-4 rounded-lg bg-zinc-800 border border-zinc-800 text-left hover:bg-zinc-700 transition-all active:scale-95"
    >
      <span className="text-white font-semibold block truncate">{product.name}</span>
    </button>
  );
});

ProductButton.displayName = 'ProductButton';

// ============================================
// 🧩 SOUS-COMPOSANT: SizeButton
// ============================================

interface SizeButtonProps {
  size: string;
  price: number;
  isSelected: boolean;
  onClick: (size: BottleSize) => void;
}

const SizeButton: React.FC<SizeButtonProps> = memo(({ size, price, isSelected, onClick }) => {
  const handleClick = useCallback(() => onClick(size as BottleSize), [onClick, size]);
  
  return (
    <button
      onClick={handleClick}
      className={`p-4 rounded-lg font-medium text-sm uppercase border-2 transition-all active:scale-95 ${
        isSelected
          ? 'bg-white border-white text-black'
          : 'bg-zinc-800 border-zinc-800 text-white'
      }`}
    >
      {size}<br/><span className="text-lg">{price}€</span>
    </button>
  );
});

SizeButton.displayName = 'SizeButton';

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  client,
  products,
  onClose,
  onSuccess,
}) => {
  const basket = useOrderBasket();
  const form = useOrderForm();
  const isSubmittingRef = useRef(false);
  const [mobileView, setMobileView] = useState<'menu' | 'basket'>('menu');

  // Reset complet à chaque ouverture (nettoyage panier, vue, form)
  useEffect(() => {
    if (isOpen) {
      basket.clearBasket();
      form.reset();
      setMobileView('menu');
      isSubmittingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, client?.id]);

  // Catégories uniques
  const categories = [...new Set(products.map(p => p.category))];

  // Produits filtrés par catégorie
  const filteredProducts = products.filter(p => p.category === form.selectedCategory);

  // Fermeture : UNIQUEMENT onClose(), pas de setState enfant mélangé
  // Le nettoyage se fait via useEffect à la prochaine ouverture
  const handleClose = () => {
    onClose();
  };

  const handleSendOrder = useCallback(() => {
    if (!client || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const clientSnapshot = client;
    // Fermer le modal IMMEDIATEMENT, puis soumettre en arriere-plan
    onClose();
    onSuccess?.();
    // submitOrder en background (clearBasket + notification geres dedans)
    basket.submitOrder(clientSnapshot);
  }, [client, basket, onClose, onSuccess]);

  const handleAddToBasket = useCallback(() => {
    if (!form.selectedProduct) return;
    basket.addProduct(form.selectedProduct, form.selectedSize, form.quantity);
    form.reset();
  }, [form, basket]);

  const handleAddManualItem = useCallback(() => {
    basket.addManualItem(form.manualName, parseFloat(form.manualPrice));
    form.reset();
  }, [form, basket]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-zinc-900 flex flex-col md:flex-row h-full overflow-hidden animate-in fade-in duration-300">

      {/* TOGGLE MOBILE Menu/Panier */}
      <div className="md:hidden bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-sm font-semibold text-white truncate flex-1">
            {client.name}
          </h3>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors ml-2">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setMobileView('menu')}
            className={`flex-1 py-3 rounded-xl font-medium uppercase text-xs transition-all ${mobileView === 'menu' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}
          >
            Menu
          </button>
          <button
            onClick={() => setMobileView('basket')}
            className={`flex-1 py-3 rounded-xl font-medium uppercase text-xs transition-all ${mobileView === 'basket' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}
          >
            Panier {!basket.isEmpty && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${mobileView === 'basket' ? 'bg-black text-white' : 'bg-emerald-500 text-white'}`}>{basket.itemCount}</span>}
          </button>
        </div>
      </div>

      {/* COLONNE GAUCHE: MENU / SELECTION */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden md:border-r border-zinc-800 ${mobileView !== 'menu' ? 'hidden md:flex' : 'flex'}`}>
        {/* Header desktop */}
        <div className="hidden md:flex p-6 border-b border-zinc-800 justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-semibold text-white">{client.name}</h3>
            <p className="text-zinc-400 text-xs font-semibold">Nouvelle Commande</p>
          </div>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Contenu menu */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP: Catégories */}
          {form.step === 'category' && (
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => (
                <CategoryButton key={cat} category={cat} onClick={form.selectCategory} />
              ))}
              <button
                onClick={() => form.goToStep('manual')}
                className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-medium uppercase hover:bg-amber-500/20 transition-all active:scale-95"
              >
                Saisie Manuelle
              </button>
            </div>
          )}

          {/* STEP: Produits */}
          {form.step === 'product' && (
            <div className="space-y-4">
              <button onClick={form.goBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" /> Retour
              </button>
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                  <ProductButton key={product.id} product={product} onClick={form.selectProduct} />
                ))}
              </div>
            </div>
          )}

          {/* STEP: Configuration */}
          {form.step === 'configure' && form.selectedProduct && (
            <div className="space-y-6">
              <button onClick={form.goBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" /> Retour
              </button>

              <div className="text-center">
                <h4 className="text-2xl font-semibold text-white">{form.selectedProduct.name}</h4>
              </div>

              {/* Tailles */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(form.selectedProduct.prices)
                  .filter(([_, price]) => price > 0)
                  .map(([size, price]) => (
                    <SizeButton
                      key={size}
                      size={size}
                      price={price}
                      isSelected={form.selectedSize === size}
                      onClick={form.setSize}
                    />
                  ))}
              </div>

              {/* Quantité */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => form.setQuantity(Math.max(1, form.quantity - 1))}
                  className="w-14 h-14 rounded-full bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-all"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <span className="text-5xl font-semibold text-white">{form.quantity}</span>
                <button
                  onClick={() => form.setQuantity(form.quantity + 1)}
                  className="w-14 h-14 rounded-full bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-all"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Ajouter */}
              <button
                onClick={handleAddToBasket}
                className="w-full bg-emerald-600 text-white py-5 rounded-lg font-medium uppercase active:scale-95 transition-all"
              >
                Ajouter au panier
              </button>
            </div>
          )}

          {/* STEP: Article manuel */}
          {form.step === 'manual' && (
            <div className="space-y-6">
              <button onClick={form.goBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" /> Retour
              </button>
              <input
                type="text"
                placeholder="NOM DE L'ARTICLE"
                value={form.manualName}
                onChange={e => form.setManualName(e.target.value.toUpperCase())}
                className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-4 px-6 text-white font-medium uppercase outline-none focus:border-zinc-500 transition-colors"
                autoFocus
              />
              <input
                type="number"
                placeholder="PRIX (€)"
                value={form.manualPrice}
                onChange={e => form.setManualPrice(e.target.value)}
                className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-4 px-6 text-white font-medium outline-none focus:border-zinc-500 transition-colors"
              />
              <button
                onClick={handleAddManualItem}
                disabled={!form.manualName || !form.manualPrice}
                className="w-full bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase active:scale-95 transition-all"
              >
                Ajouter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* COLONNE DROITE: PANIER */}
      <div className={`w-full md:w-1/3 bg-zinc-900 flex flex-col h-full md:border-l border-zinc-800 ${mobileView !== 'basket' ? 'hidden md:flex' : 'flex'}`}>
        <div className="hidden md:block p-6 border-b border-zinc-800">
          <h5 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Panier
          </h5>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {basket.isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-4">
              <ShoppingCart className="w-16 h-16" />
              <p className="font-medium text-xs">Panier vide</p>
            </div>
          ) : (
            basket.items.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-800 p-4 rounded-lg border border-zinc-800">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white uppercase">
                    {item.quantity}x {item.productName}
                  </p>
                  <p className="text-xs text-zinc-500 font-semibold">{item.subtotal}€</p>
                </div>
                <button
                  onClick={() => basket.removeItem(item.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer panier */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900 shrink-0 space-y-3">
          <input
            type="text"
            placeholder="Note (optionnel)"
            value={basket.note}
            onChange={e => basket.setNote(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-zinc-500 transition-colors"
          />
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-zinc-500">Total</span>
            <span className="text-3xl font-semibold text-white">{basket.total}€</span>
          </div>
          <button
            onClick={handleSendOrder}
            disabled={basket.isEmpty}
            className="w-full bg-white text-black py-5 rounded-lg font-medium uppercase flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30"
          >
            <Send className="w-5 h-5" />
            Envoyer ({basket.itemCount} articles)
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModal;