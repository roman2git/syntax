/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import LRItem from './lr-item';

/**
 * An abstraction for an items set (kernel plus added),
 * known as a "closure". Recursively closes over
 * all added items, eventually forming an LR-parsing state.
 *
 * Usually there is one kernel item in a state, however there are
 * cases when kernel may contain several items. E.g. being in the state:
 *
 * S' -> • S
 * S  -> • S "a"
 *     | • "b"
 *
 * and having a transition on S, we get both first two items in the
 * kernel of the next state:
 *
 * S' -> S •
 * S  -> S • "a"
 *
 * NOTE: for LR(0) parser the state above is a "shift-reduce" conflict,
 * however it may not be a conflict for other parser type, e.g. SLR(1).
 */
export default class Closure {

  /**
   * A closure state may have several kernel items. An initial kernel
   * item can be passed in the constructor, other kernel items can
   * be added later via `add` method.
   */
  constructor({initialKernelItem, grammar, canonicalCollection}) {
    this._kernelItems = [];
    this._items = [];
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._number = null;

    // A map from transition symbol to the next state.
    this._transitionsForSymbol = {};

    // To avoid infinite recursion in case if an added item
    // is for a recursive production, S -> S "a".
    this._handledNonTerminals = {};

    if (initialKernelItem) {
      this.addKernelItem(initialKernelItem);
    }

    // And register the state in the collection.
    this._canonicalCollection.registerState(this);
  }

  /**
   * State number in the canonical collection.
   */
  getNumber() {
    return this._number;
  }

  /**
   * Canonical collection can assign a specific
   * number to this state.
   */
  setNumber(number) {
    this._number = number;
  }

  /**
   * Kernel items for which the closure is built.
   */
  getKernelItems() {
    return this._kernelItems;
  }

  /**
   * All items in this closure (kernel plus all expanded).
   */
  getItems() {
    return this._items;
  }

  /**
   * Whether this state is final.
   */
  isFinal() {
    return this.getItems().length === 1 && this.getItems()[0].isFinal();
  }

  /**
   * Whether the state is accepting.
   */
  isAccept() {
    return this.isFinal() && this.getItems()[0].getProduction().isAugmented();
  }

  hasTransitionOnSymbol(symbol) {
    return this._transitionsForSymbol.hasOwnProperty(symbol);
  }

  getTransitionOnSymbol(symbol) {
    if (!this.hasTransitionOnSymbol(symbol)) {
      return null;
    }
    return this._transitionsForSymbol[symbol];
  }

  addSymbolTransition({item, closure}) {
    let transitionSymbol = item.getCurrentSymbol().getSymbol();

    if (!this.hasTransitionOnSymbol(transitionSymbol)) {
      this._transitionsForSymbol[transitionSymbol] = {
        items: [],
        closure,
      };
    }

    this._transitionsForSymbol[transitionSymbol].items.push(item);
  }

  /**
   * Goto operation from the items set. The item can be used in
   * different closures, but always goes to the same outer closure
   * (the `this` closure is passed as a parameter to the item's goto).
   *
   * Initial item (for the augmented production) builds the whole
   * graph of the canonical collection of LR items.
   *
   */
  goto() {
    this._items.forEach(item => item.goto(this));
  }

  addKernelItem(kernelItem) {
    this._kernelItems.push(kernelItem);
    this.addItem(kernelItem);
  }

  isKernelItem(item) {
    return this._kernelItems.indexOf(item) !== -1;
  }

  /**
   * Expands items until there is any item (kernel or added)
   * with a non-terminal at the dot position.
   */
  addItem(item) {
    this._items.push(item);

    if (!item.shouldClosure()) {
      return;
    }

    let currentSymbol = item.getCurrentSymbol().getSymbol();

    if (this._handledNonTerminals.hasOwnProperty(currentSymbol)) {
      return;
    }

    this._handledNonTerminals[currentSymbol] = true;

    let productionsForSymbol = this._grammar
      .getProductionsForSymbol(currentSymbol);

    productionsForSymbol.forEach(production => {
      // Recursively closure the added item.
      this.addItem(this._getItemForProduction(production));
    });
  }

  _getItemForProduction(production) {
    let itemKey = LRItem.keyForItem(production, 0);
    let item;

    // Register a new item if it's not calculated yet.
    if (!this._canonicalCollection.isItemRegistered(itemKey)) {
      item = new LRItem({
        production,
        dotPosition: 0,
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
      });
      this._canonicalCollection.registerItem(item);
    } else {
      // Reuse the same item which was already calculated.
      item = this._canonicalCollection.getItemForKey(itemKey);
    }

    return item;
  }
};