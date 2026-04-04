/**
 * 📁 hooks/useOrderActions.ts
 * Hook pour les actions sur les commandes
 * 
 * @description Centralise toutes les actions liées aux commandes avec
 * les callbacks mémorisés et la gestion du panier.
 */

import { useState, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { OrderItem, Product, Client } from '../types';
import { generateShortId, BottleSize, BOTTLE_SIZES } from '../utils';

// ============================================
// 📝 TYPES
// ============================================

export interface UseOrderActionsReturn {
  handleCreateOrder: (clientId: string, tableId: string, items: OrderItem[], note?: string) => void;
  handleValidateOrder: (orderId: string, correctedPrices?: { itemId: string; price: number }[]) => void;
  handleCancelOrder: (orderId: string, reason: string) => void;
  handleRemoveItemFromPending: (orderId: string, itemId: string) => Promise<void>;
  handleRemoveItemFromServed: (orderId: string, itemId: string) => Promise<void>;
  handleUpdateItemPrice: (orderId: string, itemId: string, newPrice: number, reason: string) => Promise<void>;
}

export const useOrderActions = (): UseOrderActionsReturn => {
  const createOrder = useStore(state => state.createOrder);
  const validateOrder = useStore(state => state.validateOrder);
  const cancelOrder = useStore(state => state.cancelOrder);
  const removeItemFromPendingOrder = useStore(state => state.removeItemFromPendingOrder);
  const removeItemFromServedOrder = useStore(state => state.removeItemFromServedOrder);
  const updateServedItemPrice = useStore(state => state.updateServedItemPrice);
  const currentUser = useStore(state => state.currentUser);
  const addNotification = useStore(state => state.addNotification);

  const handleCreateOrder = useCallback((clientId: string, tableId: string, items: OrderItem[], note?: string) => {
    if (!currentUser) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Utilisateur non connecté' });
      return;
    }
    if (items.length === 0) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'La commande est vide' });
      return;
    }
    createOrder(clientId, tableId, currentUser.id, items, note);
  }, [createOrder, currentUser, addNotification]);

  const handleValidateOrder = useCallback((orderId: string, correctedPrices?: { itemId: string; price: number }[]) => {
    validateOrder(orderId, correctedPrices);
  }, [validateOrder]);

  const handleCancelOrder = useCallback((orderId: string, reason: string) => {
    if (!reason.trim()) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Veuillez indiquer une raison' });
      return;
    }
    cancelOrder(orderId, reason);
  }, [cancelOrder, addNotification]);

  const handleRemoveItemFromPending = useCallback(async (orderId: string, itemId: string) => {
    await removeItemFromPendingOrder(orderId, itemId);
  }, [removeItemFromPendingOrder]);

  const handleRemoveItemFromServed = useCallback(async (orderId: string, itemId: string) => {
    await removeItemFromServedOrder(orderId, itemId);
  }, [removeItemFromServedOrder]);

  const handleUpdateItemPrice = useCallback(async (orderId: string, itemId: string, newPrice: number, reason: string) => {
    if (!reason.trim()) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Veuillez indiquer une raison' });
      return;
    }
    await updateServedItemPrice(orderId, itemId, newPrice, reason);
  }, [updateServedItemPrice, addNotification]);

  return {
    handleCreateOrder,
    handleValidateOrder,
    handleCancelOrder,
    handleRemoveItemFromPending,
    handleRemoveItemFromServed,
    handleUpdateItemPrice,
  };
};

// ============================================
// 🛒 HOOK PANIER DE COMMANDE
// ============================================

export interface UseOrderBasketReturn {
  items: OrderItem[];
  note: string;
  total: number;
  itemCount: number;
  isEmpty: boolean;
  addProduct: (product: Product, size: BottleSize, quantity?: number) => void;
  addManualItem: (name: string, price: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  setNote: (note: string) => void;
  clearBasket: () => void;
  submitOrder: (client: Client) => void;
}

export const useOrderBasket = (): UseOrderBasketReturn => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [note, setNote] = useState('');
  
  const currentUser = useStore(state => state.currentUser);
  const createOrder = useStore(state => state.createOrder);
  const addNotification = useStore(state => state.addNotification);

  const total = useMemo(() => items.reduce((acc, item) => acc + item.subtotal, 0), [items]);
  const itemCount = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
  const isEmpty = items.length === 0;

  const addProduct = useCallback((product: Product, size: BottleSize, quantity: number = 1) => {
    const price = product.prices[size];
    if (!price) {
      addNotification({ type: 'error', title: 'ERREUR', message: `Prix non disponible pour cette taille` });
      return;
    }
    const newItem: OrderItem = {
      id: generateShortId('item'),
      productId: product.id,
      productName: product.name,
      size,
      quantity,
      unitPrice: price,
      subtotal: price * quantity,
    };
    setItems(prev => [...prev, newItem]);
  }, [addNotification]);

  const addManualItem = useCallback((name: string, price: number) => {
    if (!name.trim() || isNaN(price) || price <= 0) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Nom et prix valides requis' });
      return;
    }
    const newItem: OrderItem = {
      id: generateShortId('manual'),
      productId: 'manual-divers',
      productName: name.toUpperCase(),
      size: 'standard',
      quantity: 1,
      unitPrice: price,
      subtotal: price,
    };
    setItems(prev => [...prev, newItem]);
  }, [addNotification]);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity < 1) {
      setItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity, subtotal: item.unitPrice * quantity };
      }
      return item;
    }));
  }, []);

  const clearBasket = useCallback(() => {
    setItems([]);
    setNote('');
  }, []);

  const submitOrder = useCallback((client: Client) => {
    if (!currentUser) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Utilisateur non connecté' });
      return;
    }
    if (isEmpty) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Le panier est vide' });
      return;
    }
    if (!client.tableId) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Le client n\'a pas de table assignée' });
      return;
    }
    createOrder(client.id, client.tableId, currentUser.id, items, note);
    clearBasket();
    addNotification({ type: 'success', title: 'COMMANDE ENVOYÉE', message: `${itemCount} article(s) - ${total}€` });
  }, [currentUser, isEmpty, items, note, itemCount, total, createOrder, clearBasket, addNotification]);

  return {
    items, note, total, itemCount, isEmpty,
    addProduct, addManualItem, removeItem, updateQuantity, setNote, clearBasket, submitOrder,
  };
};

// ============================================
// 🎛️ HOOK FORMULAIRE COMMANDE
// ============================================

export type OrderStep = 'category' | 'product' | 'configure' | 'manual';

export interface UseOrderFormReturn {
  step: OrderStep;
  selectedCategory: string;
  selectedProduct: Product | null;
  selectedSize: BottleSize;
  quantity: number;
  manualName: string;
  manualPrice: string;
  goToStep: (step: OrderStep) => void;
  selectCategory: (category: string) => void;
  selectProduct: (product: Product) => void;
  setSize: (size: BottleSize) => void;
  setQuantity: (qty: number) => void;
  setManualName: (name: string) => void;
  setManualPrice: (price: string) => void;
  reset: () => void;
  goBack: () => void;
}

export const useOrderForm = (): UseOrderFormReturn => {
  const [step, setStep] = useState<OrderStep>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<BottleSize>('standard');
  const [quantity, setQuantity] = useState(1);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const goToStep = useCallback((newStep: OrderStep) => {
    setStep(newStep);
  }, []);

  const selectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setStep('product');
  }, []);

  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSelectedSize('standard');
    setQuantity(1);
    setStep('configure');
  }, []);

  const reset = useCallback(() => {
    setStep('category');
    setSelectedCategory('');
    setSelectedProduct(null);
    setSelectedSize('standard');
    setQuantity(1);
    setManualName('');
    setManualPrice('');
  }, []);

  const goBack = useCallback(() => {
    switch (step) {
      case 'product':
        setStep('category');
        setSelectedCategory('');
        break;
      case 'configure':
        setStep('product');
        setSelectedProduct(null);
        break;
      case 'manual':
        setStep('category');
        setManualName('');
        setManualPrice('');
        break;
      default:
        break;
    }
  }, [step]);

  return {
    step,
    selectedCategory,
    selectedProduct,
    selectedSize,
    quantity,
    manualName,
    manualPrice,
    goToStep,
    selectCategory,
    selectProduct,
    setSize: setSelectedSize,
    setQuantity,
    setManualName,
    setManualPrice,
    reset,
    goBack,
  };
};
