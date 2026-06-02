class TabList extends HTMLUListElement {
  constructor() {
    super();

    this.controls.forEach((button) => button.addEventListener('click', this.handleButtonClick.bind(this)));
  }

  get controls() {
    return this._controls = this._controls || Array.from(this.querySelectorAll('[aria-controls]'));
  }

  handleButtonClick(event) {
    event.preventDefault();

    this.controls.forEach((button) => {
      button.setAttribute('aria-expanded', 'false');

      const panel = document.getElementById(button.getAttribute('aria-controls'));
      panel?.removeAttribute('open');
    });

    const target = event.currentTarget;
    target.setAttribute('aria-expanded', 'true');

    const panel = document.getElementById(target.getAttribute('aria-controls'));
    panel?.setAttribute('open', '');
  }

  reset() {
    const firstControl = this.controls[0];
    firstControl.dispatchEvent(new Event('click'));
  }
}
customElements.define('tab-list', TabList, { extends: 'ul' });

class CartDrawer extends DrawerElement {
  constructor() {
    super();

    this.onPrepareBundledSectionsListener = this.onPrepareBundledSections.bind(this);
    this.onCartRefreshListener = this.onCartRefresh.bind(this);
  }

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  get shouldAppendToBody() {
    return false;
  }

  get recentlyViewed() {
    return this.querySelector('recently-viewed');
  }

  get tabList() {
    return this.querySelector('[is="tab-list"]');
  }

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener('cart:bundled-sections', this.onPrepareBundledSectionsListener);
    document.addEventListener('cart:refresh', this.onCartRefreshListener);
    if (this.recentlyViewed) {
      this.recentlyViewed.addEventListener('is-empty', this.onRecentlyViewedEmpty.bind(this));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener('cart:bundled-sections', this.onPrepareBundledSectionsListener);
    document.removeEventListener('cart:refresh', this.onCartRefreshListener);
  }

  onPrepareBundledSections(event) {
    event.detail.sections.push(this.sectionId);
  }

  onRecentlyViewedEmpty() {
    this.recentlyViewed.innerHTML = `
    <div class="drawer__scrollable relative flex justify-center items-start grow shrink text-center">
      <div class="drawer__empty grid gap-5 md:gap-8">
        <h2 class="drawer__empty-text heading leading-none tracking-tight">${theme.strings.recentlyViewedEmpty}</h2>
      </div>
    </div>
    `;
  }

  async onCartRefresh(event) {
    const id = `MiniCart-${this.sectionId}`;
    if (document.getElementById(id) === null) return;

    const responseText = await (await fetch(`${theme.routes.root_url}?section_id=${this.sectionId}`)).text();
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id).innerHTML;

    if (event.detail.open === true) {
      this.show();
    }
  }

  show(focusElement = null, animate = true) {
    super.show(focusElement, animate);

    if (this.tabList) {
      this.tabList.reset();

      if (this.open) {
        theme.a11y.trapFocus(this, this.focusElement);
      }
    }
  }
}
customElements.define('cart-drawer', CartDrawer);

class CartRemoveButton extends HTMLAnchorElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();

      const cartItems = this.closest('cart-items');
      cartItems.updateQuantity(this.getAttribute('data-index'), 0);
    });
  }
}
customElements.define('cart-remove-button', CartRemoveButton, { extends: 'a' });

class QuantityRemoveButton extends HTMLButtonElement {
  constructor() {
    super();

    if (this.hasAttribute('data-bundle-id')) {
      this.addEventListener('click', (event) => {
        event.preventDefault();
      
        const cartItems = this.closest('cart-items');
        const bundleId = this.getAttribute('data-bundle-id');
      
        const bundledButtons = document.querySelectorAll(`button[data-bundle-id="${bundleId}"]`);
      
        const itemsToUpdate = Array.from(bundledButtons).map((btn) => {
          const lineIndex = btn.getAttribute('data-index');
          if (lineIndex) {
            return { lineIndex, quantity: 0 };
          }
        }).filter(Boolean);
      
        cartItems.updateMultipleQuantities(itemsToUpdate).then(() => {
          console.log('所有同 bundleId 的项都删除完成');
        });
      });
      
    }
  }
}

customElements.define('quantity-remove-button', QuantityRemoveButton, { extends: 'button' });

class QuantityAdjustButton extends HTMLButtonElement {
  constructor() {
    super();

    this.isUpdating = false;

    if (this.hasAttribute('data-bundle-id')) {
      this.addEventListener('click', async (event) => {
        event.preventDefault();

        if (this.isUpdating) {
          return;
        }

        this.isUpdating = true;

        const cartItems = this.closest('cart-items');
        const bundleId = this.getAttribute('data-bundle-id');
        const isPlusButton = this.getAttribute('name') === 'plus';

        const bundledButtons = document.querySelectorAll(`button[is="quantity-adjust-button"][data-bundle-id="${bundleId}"]`);

        // 👉 先获取当前点击按钮对应的数量
        const currentLineIndex = this.getAttribute('data-index');
        const currentListItem = this.closest('li') || this.closest('tr');
        const currentQuantityInput = currentListItem.querySelector(`input[type="number"][data-index="${currentLineIndex}"]`);
        let baseQuantity = parseInt(currentQuantityInput.value);

        if (baseQuantity < 1) baseQuantity = 1;

        // 👉 所有相同 bundleId 的项统一改成 baseQuantity
        const itemsToUpdate = [];
        for (const btn of bundledButtons) {
          const lineIndex = btn.getAttribute('data-index');
          if (lineIndex) {
            itemsToUpdate.push({ lineIndex, quantity: baseQuantity });
          }
        }

        try {
          await cartItems.updateMultipleQuantitiesByKey(itemsToUpdate);
          // console.log(`bundleId ${bundleId} 的所有项数量统一更新为 ${baseQuantity}`);
        } catch (error) {
          console.error('更新数量失败', error);
        } finally {
          this.isUpdating = false;
        }
      });
    }
  }
}

customElements.define('quantity-adjust-button', QuantityAdjustButton, { extends: 'button' });


class QuantityAdjustInput extends HTMLInputElement {
  constructor() {
    super();

    this.isUpdating = false;

    if (this.hasAttribute('data-bundle-id')) {
      const handleUpdate = async () => {
        if (this.isUpdating) return;

        this.isUpdating = true;

        const cartItems = this.closest('cart-items');
        const bundleId = this.getAttribute('data-bundle-id');
        const bundledInputs = document.querySelectorAll(`input[is="quantity-adjust-input"][data-bundle-id="${bundleId}"]`);

        let baseQuantity = parseInt(this.value);
        if (isNaN(baseQuantity) || baseQuantity < 1) baseQuantity = 1;

        const itemsToUpdate = [];
        for (const input of bundledInputs) {
          const lineIndex = input.getAttribute('data-index');
          if (lineIndex) {
            itemsToUpdate.push({ lineIndex, quantity: baseQuantity });
          }
        }

        try {
          await cartItems.updateMultipleQuantitiesByKey(itemsToUpdate);
          // console.log(`bundleId ${bundleId} 的所有项数量统一更新为 ${baseQuantity}`);
        } catch (error) {
          console.error('更新数量失败', error);
        } finally {
          this.isUpdating = false;
        }
      };

      // 👉 监听 change（失焦或 Enter 都会触发）
      this.addEventListener('change', handleUpdate);

      // 👉 监听 Enter 键，阻止默认提交，同时执行同步逻辑
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleUpdate();
        }
      });
    }
  }
}

customElements.define('quantity-adjust-input', QuantityAdjustInput, { extends: 'input' });

class CartItems extends HTMLElement {
  cartUpdateUnsubscriber = undefined;

  constructor() {
    super();

    this.addEventListener('change', theme.utils.debounce(this.onChange.bind(this), 300));
    this.cartUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate.bind(this));
  }

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate(event) {
    if (event.cart.errors) {
      this.onCartError(event.cart.errors, event.target);
      return;
    }

    const sectionToRender = new DOMParser().parseFromString(event.cart.sections[this.sectionId], 'text/html');

    const miniCart = document.querySelector(`#MiniCart-${this.sectionId}`);
    if (miniCart) {
      const updatedElement = sectionToRender.querySelector(`#MiniCart-${this.sectionId}`);
      if (updatedElement) {
        miniCart.innerHTML = updatedElement.innerHTML;
      }
    }

    const mainCart = document.querySelector(`#MainCart-${this.sectionId}`);
    if (mainCart) {
      const updatedElement = sectionToRender.querySelector(`#MainCart-${this.sectionId}`);
      if (updatedElement) {
        mainCart.innerHTML = updatedElement.innerHTML;
      }
      else {
        mainCart.closest('.cart').classList.add('is-empty');
        mainCart.remove();
      }
    }

    const lineItem = document.getElementById(`CartItem-${event.line}`) || document.getElementById(`CartDrawer-Item-${event.line}`);
    if (lineItem && lineItem.querySelector(`[name="${event.name}"]`)) {
      theme.a11y.trapFocus(mainCart || miniCart, lineItem.querySelector(`[name="${event.name}"]`));
    }
    else if (event.cart.item_count === 0) {
      miniCart
        ? theme.a11y.trapFocus(miniCart, miniCart.querySelector('a'))
        : theme.a11y.trapFocus(document.querySelector('.empty-state'), document.querySelector('.empty-state__link'));
    }
    else {
      miniCart
        ? theme.a11y.trapFocus(miniCart, miniCart.querySelector('.horizontal-product__title'))
        : theme.a11y.trapFocus(mainCart, mainCart.querySelector('.cart__item-title'));
    }

    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: {
        cart: event.cart
      }
    }));
  }

  onCartError(errors, target) {
    if (target) {
      // this.updateQuantity(target.getAttribute('data-index'), target.defaultValue, document.activeElement.getAttribute('name'), target);
      this.disableLoading(target.getAttribute('data-index'));
      this.setValidity(target, errors);
      return;
    }
    else {
      window.location.href = theme.routes.cart_url;
    }

    alert(errors);
  }

  updateQuantity(line, quantity, name, target) {
    this.enableLoading(line);

    if (target && target.hasAttribute('data-bundle-id')) {
          console.log('跳过 cartUpdate，因 data-bundle-id 存在');
          return;
     }

    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));

    const body = JSON.stringify({
      id: line,
      quantity,
      sections: sectionsToBundle
    });

    fetch(`${theme.routes.cart_change_url}`, { ...theme.utils.fetchConfig(), ...{ body } })
      .then((response) => response.json())
      .then((parsedState) => {
        console.log('target: ', target);
        if (target && target.hasAttribute('data-bundle-id')) {
             console.log('跳过 cartUpdate，因 data-bundle-id 存在');
             return;
        }
        theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cart: parsedState, target, line, name });
        
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('Fetch aborted by user');
        }
        else {
          console.error(error);
        }
      });
  }

  // updateMultipleQuantitiesByKey(items) {
  //   let sectionsToBundle = [];
  //   document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));
  //   // 去重
  //   const uniqueItemsMap = new Map();
  //   items.forEach(({ lineIndex, quantity }) => {
  //     uniqueItemsMap.set(lineIndex, quantity);
  //   });
  //   const uniqueItems = Array.from(uniqueItemsMap, ([lineIndex, quantity]) => ({ lineIndex, quantity }));
   
  //   uniqueItems.forEach(({ lineIndex }) => {
  //    this.enableLoading(lineIndex);
  //   });
  //   let lastParsedState = null;
   
  //   for (const { lineIndex, quantity } of uniqueItems) {
  //     this.enableLoading(lineIndex);
   
  //     const body = JSON.stringify({
  //       id: lineIndex,
  //       quantity,
  //       sections: sectionsToBundle
  //     });
   
  //     try {
  //       const response = await fetch(${theme.routes.cart_change_url}, {
  //         ...theme.utils.fetchConfig(),
  //         ...{ body }
  //       });
   
  //       const parsedState = await response.json();
  //       lastParsedState = parsedState;
   
  //       theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, {
  //         source: 'cart-items',
  //         cart: parsedState,
  //         line: lineIndex
  //       });
   
  //     } catch (error) {
  //       if (error.name === 'AbortError') {
  //         console.log('Fetch aborted by user');
  //       } else {
  //         console.error(error);
  //       }
  //     }
  //   }
   
  //    uniqueItems.forEach(({ lineIndex }) => {
  //     this.disableLoading(lineIndex);
  //    });
  //   return lastParsedState;
  // }

 async updateMultipleQuantitiesByKey(items) {
  let sectionsToBundle = [];
  document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));

  // 去重
  const uniqueItemsMap = new Map();
  items.forEach(({ lineIndex, quantity }) => {
    uniqueItemsMap.set(lineIndex, quantity);
  });

  const updates = {};
  uniqueItemsMap.forEach((quantity, lineIndex) => {
    updates[lineIndex] = quantity;
  });

  const checkoutButtons = document.querySelectorAll('.button[name="checkout"]');
  if (checkoutButtons.length > 0) {
    checkoutButtons.forEach(button => {
      button.classList.add('loading');
    });
  }

  Array.from(uniqueItemsMap.keys()).forEach(lineIndex => {
    this.enableLoading(lineIndex);
  });

  let latestParsedState = null;

  const body = JSON.stringify({
    updates,
    sections: sectionsToBundle
  });

  try {
    const response = await fetch(`${theme.routes.cart_update_url}`, {
      ...theme.utils.fetchConfig(),
      ...{ body }
    });

    latestParsedState = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted by user');
    } else {
      console.error(error);
    }
  }

  Array.from(uniqueItemsMap.keys()).forEach(lineIndex => {
    this.disableLoading(lineIndex);
  });

  if (latestParsedState) {
    theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, {
      source: 'cart-items',
      cart: latestParsedState
    });
  }

  if (checkoutButtons.length > 0) {
    checkoutButtons.forEach(button => {
      button.classList.remove('loading');
    });
  }

  const $loading = document.querySelectorAll('cart-items div.loader');
  if ($loading.length > 0) {
    $loading.forEach($loader => {
      $loader.hidden = true;
    });
  }

  return latestParsedState;
}

  updateMultipleQuantities(items) {
    items.forEach(({ lineIndex }) => {
      this.enableLoading(lineIndex);
    });
  
    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));
  
    // 构造 updates 对象
    const updates = {};
    items.forEach(({ lineIndex, quantity }) => {
      updates[lineIndex] = quantity;
    });

  
    const body = JSON.stringify({
      updates: updates,
      sections: sectionsToBundle
    });
  
    return fetch(`${theme.routes.cart_update_url}`, { 
        ...theme.utils.fetchConfig(), 
        ...{ body }
      })
      .then((response) => response.json())
      .then((parsedState) => {
        theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cart: parsedState });
        return parsedState;
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('Fetch aborted by user');
        } else {
          console.error(error);
        }
      });
  }
  

  enableLoading(line) {
    const loader = document.getElementById(`Loader-${this.sectionId}-${line}`);
    if (loader) loader.hidden = false;
  }

  disableLoading(line) {
    const loader = document.getElementById(`Loader-${this.sectionId}-${line}`);
    if (loader) loader.hidden = true;
  }

  setValidity(target, message) {
    target.setCustomValidity(message);
    target.reportValidity();
    target.value = target.defaultValue;
    target.select();
  }

  validateQuantity(event) {
    const target = event.target;
    const inputValue = parseInt(target.value);
    const index = target.getAttribute('data-index');
    let message = '';

    if (inputValue < parseInt(target.getAttribute('data-min'))) {
      message = theme.quickOrderListStrings.minError.replace('[min]', target.getAttribute('data-min'));
    }
    else if (inputValue > parseInt(target.max)) {
      message = theme.quickOrderListStrings.maxError.replace('[max]', target.max);
    }
    else if (inputValue % parseInt(target.step) !== 0) {
      message = theme.quickOrderListStrings.stepError.replace('[step]', target.step);
    }

    if (message) {
      this.setValidity(target, message);
    }
    else {
      target.setCustomValidity('');
      target.reportValidity();
      this.updateQuantity(index, inputValue, document.activeElement.getAttribute('name'), target);
    }
  }
}
customElements.define('cart-items', CartItems);

class CartNote extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('change', theme.utils.debounce(this.onChange.bind(this), 300));
  }

  onChange(event) {
    const body = JSON.stringify({ note: event.target.value });
    fetch(`${theme.routes.cart_update_url}`, { ...theme.utils.fetchConfig(), ...{ body } });
  }
}
customElements.define('cart-note', CartNote);

class MainCart extends HTMLElement {
  constructor() {
    super();

    document.addEventListener('cart:bundled-sections', this.onPrepareBundledSections.bind(this));
  }

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  onPrepareBundledSections(event) {
    event.detail.sections.push(this.sectionId);
  }
}
customElements.define('main-cart', MainCart);

class CountryProvince extends HTMLElement {
  constructor() {
    super();

    this.provinceElement = this.querySelector('[name="address[province]"]');
    this.countryElement = this.querySelector('[name="address[country]"]');
    this.countryElement.addEventListener('change', this.handleCountryChange.bind(this));

    if (this.getAttribute('country') !== '') {
      this.countryElement.selectedIndex = Math.max(0, Array.from(this.countryElement.options).findIndex((option) => option.textContent === this.getAttribute('data-country')));
      this.countryElement.dispatchEvent(new Event('change'));
    }
    else {
      this.handleCountryChange();
    }
  }

  handleCountryChange() {
    const option = this.countryElement.options[this.countryElement.selectedIndex], provinces = JSON.parse(option.getAttribute('data-provinces'));
    this.provinceElement.parentElement.hidden = provinces.length === 0;

    if (provinces.length === 0) {
      return;
    }

    this.provinceElement.innerHTML = '';

    provinces.forEach((data) => {
      const selected = data[1] === this.getAttribute('data-province');
      this.provinceElement.options.add(new Option(data[1], data[0], selected, selected));
    });
  }
}
customElements.define('country-province', CountryProvince);

class ShippingCalculator extends HTMLFormElement {
  constructor() {
    super();

    this.onSubmitHandler = this.onSubmit.bind(this);
  }

  connectedCallback() {
    this.submitButton = this.querySelector('[type="submit"]');
    this.resultsElement = this.lastElementChild;

    this.submitButton.addEventListener('click', this.onSubmitHandler);
  }

  disconnectedCallback() {
    this.submitButton.removeEventListener('click', this.onSubmitHandler);
  }

  onSubmit(event) {
    event.preventDefault();

    this.abortController?.abort();
    this.abortController = new AbortController();

    const zip = this.querySelector('[name="address[zip]"]').value,
      country = this.querySelector('[name="address[country]"]').value,
      province = this.querySelector('[name="address[province]"]').value;

    this.submitButton.setAttribute('aria-busy', 'true');

    const body = JSON.stringify({
      shipping_address: { zip, country, province }
    });
    let sectionUrl = `${theme.routes.cart_url}/shipping_rates.json`;

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace('//', '/');

    fetch(sectionUrl, { ...theme.utils.fetchConfig('javascript'), ...{ body }, signal: this.abortController.signal })
      .then((response) => response.json())
      .then((parsedState) => {
        if (parsedState.shipping_rates) {
          this.formatShippingRates(parsedState.shipping_rates);
        }
        else {
          this.formatError(parsedState);
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('Fetch aborted by user');
        }
        else {
          console.error(error);
        }
      })
      .finally(() => {
        this.resultsElement.hidden = false;
        this.submitButton.removeAttribute('aria-busy');
      });
  }

  formatError(errors) {
    const shippingRatesList = Object.keys(errors).map((errorKey) => {
      return `<li>${errors[errorKey]}</li>`;
    });
    this.resultsElement.innerHTML = `
      <div class="alert alert--error grid gap-2 text-sm leading-tight">
        <p>${theme.shippingCalculatorStrings.error}</p>
        <ul class="list-disc grid gap-2" role="list">${shippingRatesList.join('')}</ul>
      </div>
    `;
  }

  formatShippingRates(shippingRates) {
    const shippingRatesList = shippingRates.map(({ presentment_name, currency, price }) => {
      return `<li>${presentment_name}: ${currency} ${price}</li>`;
    });
    this.resultsElement.innerHTML = `
      <div class="alert alert--${shippingRates.length === 0 ? 'error' : 'success'} grid gap-2 text-sm leading-tight">
        <p>${shippingRates.length === 0 ? theme.shippingCalculatorStrings.notFound : shippingRates.length === 1 ? theme.shippingCalculatorStrings.oneResult : theme.shippingCalculatorStrings.multipleResults}</p>
        ${shippingRatesList === '' ? '' : `<ul class="list-disc grid gap-2" role="list">${shippingRatesList.join('')}</ul>`}
      </div>
    `;

  }
}
customElements.define('shipping-calculator', ShippingCalculator, { extends: 'form' });
