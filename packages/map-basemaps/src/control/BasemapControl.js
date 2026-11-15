import { Control } from 'sweety-map';
import { BasemapsManager } from '../manager.js';

const DEFAULT_I18N = {
  title: 'Basemaps',
  search: 'Search basemaps',
  noResults: 'No basemaps found',
  active: 'Active',
  requiresKey: 'API key required',
  enterKey: 'Enter API key for {name}',
  keyHint: 'The key is kept in memory and is not written to localStorage.',
  apply: 'Apply',
  cancel: 'Cancel',
  terms: 'Terms',
  close: 'Close',
  streets: 'Streets',
  satellite: 'Satellite',
  terrain: 'Terrain',
  dark: 'Dark',
  transport: 'Transport',
  humanitarian: 'Humanitarian',
  custom: 'Custom',
};

const CATEGORY_ORDER = [
  'streets',
  'satellite',
  'terrain',
  'dark',
  'transport',
  'humanitarian',
  'custom',
];

const ICONS = {
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5S14.4 18.2 12 20.5C9.6 18.2 8.4 15.3 8.4 12S9.6 5.8 12 3.5z"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M15 4h4v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l4.5 4.5L19 7"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
};

/**
 * Контрол выбора подложки: компактная кнопка, поиск, категории, превью и
 * запрос API-ключа. Использует CSS-классы `.map-basemaps-*`.
 */
export class BasemapControl extends Control {
  /**
   * @param {object} [options]
   * @param {string} [options.position='topright']
   * @param {string[]} [options.providers] список id; по умолчанию все
   * @param {boolean} [options.preview=false]
   * @param {boolean} [options.compact=false]
   * @param {boolean} [options.search=true]
   * @param {object} [options.labels] подписи провайдеров: `{ osm: 'Улицы' }`
   * @param {object} [options.previewCoords] тайл для превью: `{ x, y, z }`
   * @param {object} [options.i18n]
   * @param {any} [options.manager] явный менеджер
   */
  constructor(options = {}) {
    super({
      position: 'topright',
      providers: null,
      preview: false,
      compact: false,
      search: true,
      showCategories: true,
      theme: null,
      labels: {},
      previewCoords: { x: 2, y: 1, z: 2 },
      i18n: {},
      className: '',
      ...options,
    });
    this.messages = { ...DEFAULT_I18N, ...(this.options.i18n || {}) };
    /** @type {BasemapsManager|null} */
    this._manager = this.options.manager || null;
    this._open = false;
    this._items = new Map();
    this._keyProvider = null;
    this._onPanelClick = (event) => this._handlePanelClick(event);
    this._onToggle = () => this.toggle();
    this._onSearch = () => this._applyFilter();
    this._onKeyDown = (event) => this._handleKeyDown(event);
    this._onManagerChange = () => this.refresh();
    this._onMapClick = () => {
      if (this._open) this.close();
    };
  }

  /** @param {any} map */
  onAdd(map) {
    this._manager =
      this._manager || map.basemaps || BasemapsManager.install(map, { control: false });
    if (!this._manager.control) this._manager.control = this;

    const container = this._initLayout('map-basemaps-control');
    container.classList.add('map-basemaps-control');
    if (this.options.theme) container.dataset.theme = this.options.theme;
    if (this.options.compact) container.classList.add('map-basemaps-compact');
    if (this.options.className) {
      container.classList.add(...String(this.options.className).split(/\s+/).filter(Boolean));
    }
    container.addEventListener('keydown', this._onKeyDown);

    this._toggleButton = document.createElement('button');
    this._toggleButton.type = 'button';
    this._toggleButton.className = 'map-basemaps-toggle';
    this._toggleButton.setAttribute('aria-expanded', 'false');
    this._toggleButton.setAttribute('aria-haspopup', 'dialog');
    this._toggleButton.innerHTML = `<svg class="map-basemaps-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.globe}</svg>`;
    this._toggleLabel = document.createElement('span');
    this._toggleLabel.className = 'map-basemaps-toggle-label';
    this._toggleLabel.textContent = this._t('title');
    this._toggleButton.appendChild(this._toggleLabel);
    this._toggleButton.insertAdjacentHTML(
      'beforeend',
      `<svg class="map-basemaps-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.chevron}</svg>`,
    );
    this._toggleButton.addEventListener('click', this._onToggle);
    container.appendChild(this._toggleButton);

    this._panel = document.createElement('div');
    this._panel.className = 'map-basemaps-panel';
    this._panel.hidden = true;
    this._panel.setAttribute('role', 'dialog');
    this._panel.setAttribute('aria-label', this._t('title'));
    container.appendChild(this._panel);

    this._buildPanel();
    this._manager.on('basemapchange', this._onManagerChange);
    this._manager.on('basemapadded', this._onManagerChange);
    this._manager.on('basemapremoved', this._onManagerChange);
    this._manager.on('basemaperror', this._onManagerChange);
    map.on('click', this._onMapClick);
    this.refresh();
    return container;
  }

  /** @param {any} map */
  onRemove(map) {
    map.off('click', this._onMapClick);
    if (this._manager) {
      this._manager.off('basemapchange', this._onManagerChange);
      this._manager.off('basemapadded', this._onManagerChange);
      this._manager.off('basemapremoved', this._onManagerChange);
      this._manager.off('basemaperror', this._onManagerChange);
    }
    this._panel?.removeEventListener('click', this._onPanelClick);
    this._toggleButton?.removeEventListener('click', this._onToggle);
    this._container?.removeEventListener('keydown', this._onKeyDown);
    if (this._manager?.control === this) this._manager.control = null;
    super.onRemove(map);
    this._panel = null;
    this._toggleButton = null;
    this._items.clear();
  }

  /** @returns {boolean} */
  isOpen() {
    return this._open;
  }

  open() {
    if (this._open || !this._panel) return;
    this._open = true;
    this._panel.hidden = false;
    this._toggleButton.setAttribute('aria-expanded', 'true');
    this._container.classList.add('map-basemaps-open');
    this._loadPreviews();
    this._searchInput?.focus();
  }

  close() {
    if (!this._open || !this._panel) return;
    this._open = false;
    this._panel.hidden = true;
    this._toggleButton.setAttribute('aria-expanded', 'false');
    this._container.classList.remove('map-basemaps-open');
    if (this._keyForm && !this._keyForm.hidden) this._closeKeyForm();
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  /** Обновляет активное состояние и названия. */
  refresh() {
    if (!this._manager) return;
    const active = this._manager.get();
    const activeProvider = active ? this._manager.list({ ids: [active] })[0] : null;
    if (this._toggleLabel) {
      this._toggleLabel.textContent = activeProvider
        ? this._labelFor(activeProvider)
        : this._t('title');
    }
    for (const [id, button] of this._items) {
      const isActive = id === active;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      let check = button.querySelector('.map-basemaps-check');
      if (isActive && !check) {
        check = document.createElement('span');
        check.className = 'map-basemaps-check';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS.check}</svg>`;
        button.appendChild(check);
      } else if (!isActive) {
        check?.remove();
      }
    }
  }

  /** @private */
  _buildPanel() {
    const manager = this._manager;
    if (!manager) return;
    this._panel.textContent = '';
    this._panel.addEventListener('click', this._onPanelClick);

    const head = document.createElement('div');
    head.className = 'map-basemaps-head';
    const title = document.createElement('div');
    title.className = 'map-basemaps-title';
    title.textContent = this._t('title');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'map-basemaps-close';
    close.setAttribute('aria-label', this._t('close'));
    close.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.close}</svg>`;
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this._toggleButton?.focus();
    });
    head.appendChild(title);
    head.appendChild(close);
    this._panel.appendChild(head);

    if (this.options.search) {
      const search = document.createElement('div');
      search.className = 'map-basemaps-search';
      search.insertAdjacentHTML(
        'afterbegin',
        `<svg class="map-basemaps-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.search}</svg>`,
      );
      this._searchInput = document.createElement('input');
      this._searchInput.type = 'search';
      this._searchInput.className = 'map-basemaps-search-input';
      this._searchInput.placeholder = this._t('search');
      this._searchInput.setAttribute('aria-label', this._t('search'));
      this._searchInput.addEventListener('input', this._onSearch);
      search.appendChild(this._searchInput);
      this._panel.appendChild(search);
    }

    const list = document.createElement('div');
    list.className = 'map-basemaps-list';
    if (!this.options.showCategories) list.classList.add('map-basemaps-list-flat');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', this._t('title'));
    this._list = list;
    this._panel.appendChild(list);
    this._items.clear();

    const providers = manager.list(
      this.options.providers ? { ids: this.options.providers } : undefined,
    );
    const groups = new Map();
    for (const provider of providers) {
      const category = provider.category || 'custom';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(provider);
    }
    const categories = [...groups.keys()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    );

    for (const category of categories) {
      const section = document.createElement('section');
      section.className = 'map-basemaps-group';
      section.dataset.category = category;
      if (this.options.showCategories) {
        const title = document.createElement('h3');
        title.className = 'map-basemaps-group-title';
        title.textContent = this._t(category);
        section.appendChild(title);
      }
      for (const provider of groups.get(category)) {
        section.appendChild(this._createItem(provider));
      }
      list.appendChild(section);
    }

    this._empty = document.createElement('p');
    this._empty.className = 'map-basemaps-empty';
    this._empty.textContent = this._t('noResults');
    this._empty.hidden = true;
    this._panel.appendChild(this._empty);

    this._buildKeyForm();
    this.refresh();
    this._applyFilter();
  }

  /** @private */
  _createItem(provider) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-basemaps-item';
    button.dataset.id = provider.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    const displayName = this._labelFor(provider);
    button.title = `${provider.name} · z${provider.minZoom}–${provider.maxZoom}`;
    button.dataset.search =
      `${displayName} ${provider.name} ${provider.id} ${provider.category}`.toLowerCase();

    const thumb = document.createElement('span');
    thumb.className = 'map-basemaps-thumb';
    thumb.dataset.preview = provider.id;
    thumb.dataset.category = provider.category || 'custom';
    if (!provider.requiresKey) thumb.dataset.previewPending = 'true';
    thumb.textContent = provider.requiresKey ? '' : displayName.slice(0, 1);
    if (provider.requiresKey) {
      thumb.classList.add('map-basemaps-thumb-key');
      thumb.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.key}</svg>`;
    }
    button.appendChild(thumb);

    const text = document.createElement('span');
    text.className = 'map-basemaps-item-text';
    const name = document.createElement('span');
    name.className = 'map-basemaps-item-name';
    name.textContent = displayName;
    text.appendChild(name);
    if (provider.requiresKey) {
      const meta = document.createElement('span');
      meta.className = 'map-basemaps-item-meta';
      meta.textContent = this._t('requiresKey');
      text.appendChild(meta);
    }
    button.appendChild(text);

    this._items.set(provider.id, button);
    return button;
  }

  /** @private */
  _buildKeyForm() {
    const form = document.createElement('form');
    form.className = 'map-basemaps-key';
    form.hidden = true;
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-label', this._t('requiresKey'));
    this._keyForm = form;

    const title = document.createElement('p');
    title.className = 'map-basemaps-key-title';
    this._keyTitle = title;
    form.appendChild(title);

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'map-basemaps-key-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    this._keyInput = input;
    form.appendChild(input);

    const hint = document.createElement('p');
    hint.className = 'map-basemaps-key-hint';
    hint.textContent = this._t('keyHint');
    form.appendChild(hint);

    const error = document.createElement('p');
    error.className = 'map-basemaps-key-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    this._keyError = error;
    form.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'map-basemaps-key-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'map-basemaps-key-submit';
    submit.textContent = this._t('apply');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'map-basemaps-key-cancel';
    cancel.textContent = this._t('cancel');
    cancel.addEventListener('click', (event) => {
      event.preventDefault();
      this._closeKeyForm();
    });
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);

    const terms = document.createElement('a');
    terms.className = 'map-basemaps-key-terms';
    terms.target = '_blank';
    terms.rel = 'noopener noreferrer';
    terms.textContent = this._t('terms');
    this._keyTerms = terms;
    form.appendChild(terms);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this._submitKey();
    });
    this._panel.appendChild(form);
  }

  /** @private */
  _handlePanelClick(event) {
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (!target) return;
    const item = target.closest?.('[data-id]');
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    this._selectProvider(item.dataset.id);
  }

  /** @private */
  _selectProvider(id) {
    const manager = this._manager;
    const provider = manager?.list({ ids: [id] })[0];
    if (!provider) return;
    if (provider.requiresKey && !manager.hasKey(id)) {
      this._openKeyForm(provider);
      return;
    }
    try {
      manager.set(id);
      this.close();
    } catch (error) {
      if (error?.code === 'missing-key') this._openKeyForm(provider, error);
      else this._showError(error?.message || String(error));
    }
  }

  /** @private */
  _openKeyForm(provider, error = null) {
    this._keyProvider = provider;
    this._keyForm.hidden = false;
    this._keyTitle.textContent = this._t('enterKey', { name: provider.name });
    this._keyTerms.href = provider.termsUrl || '#';
    this._keyTerms.hidden = !provider.termsUrl;
    this._keyError.hidden = !error;
    if (error) this._keyError.textContent = error.message;
    this._keyInput.value = '';
    this._keyInput.focus();
  }

  /** @private */
  _closeKeyForm() {
    this._keyProvider = null;
    if (this._keyForm) this._keyForm.hidden = true;
    if (this._keyError) this._keyError.hidden = true;
  }

  /** @private */
  _submitKey() {
    const provider = this._keyProvider;
    const key = this._keyInput?.value.trim();
    if (!provider || !key) {
      this._showError(this._t('requiresKey'));
      return;
    }
    try {
      this._manager.options.keys[provider.id] = key;
      this._manager.set(provider.id, { key });
      this._closeKeyForm();
      this.close();
    } catch (error) {
      this._showError(error?.message || String(error));
    }
  }

  /** @private */
  _showError(message) {
    if (!this._keyError) return;
    this._keyError.textContent = message;
    this._keyError.hidden = false;
  }

  /** @private */
  _applyFilter() {
    const query = (this._searchInput?.value || '').trim().toLowerCase();
    let visible = 0;
    for (const button of this._items.values()) {
      const match = !query || (button.dataset.search || '').includes(query);
      button.hidden = !match;
      if (match) visible += 1;
    }
    for (const section of this._list?.querySelectorAll('.map-basemaps-group') || []) {
      section.hidden = ![...section.querySelectorAll('.map-basemaps-item')].some(
        (button) => !button.hidden,
      );
    }
    if (this._empty) this._empty.hidden = visible > 0;
  }

  /** @private */
  _labelFor(provider) {
    const labels = this.options.labels || {};
    return labels[provider.id] || provider.name;
  }

  /** @private */
  _loadPreviews() {
    if (!this.options.preview) return;
    const manager = this._manager;
    for (const [id, button] of this._items) {
      const thumb = button.querySelector('.map-basemaps-thumb');
      if (!thumb || !thumb.dataset.previewPending) continue;
      thumb.dataset.previewPending = 'false';
      try {
        const provider = manager.list({ ids: [id] })[0];
        if (!provider) continue;
        if (provider.requiresKey && !manager.hasKey(id)) continue;
        if (
          !provider.preview &&
          provider.type &&
          provider.type !== 'xyz' &&
          provider.type !== 'xyz-json'
        ) {
          continue;
        }
        const preview = this.options.previewCoords || { x: 2, y: 1, z: 2 };
        const url = provider.preview
          ? provider.preview
          : manager.resolveUrl(id, {
              coords: { x: preview.x, y: preview.y, z: preview.z },
              subdomain: 'a',
            });
        const image = document.createElement('img');
        image.loading = 'lazy';
        image.alt = '';
        image.draggable = false;
        image.decoding = 'async';
        image.src = url;
        // При ошибке картинка убирается — остаётся цветная заглушка с буквой.
        image.addEventListener('error', () => image.remove(), { once: true });
        thumb.appendChild(image);
      } catch {
        // Без превью остаётся буква-заглушка.
      }
    }
  }

  /** @private */
  _handleKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (this._keyForm && !this._keyForm.hidden) {
      event.stopPropagation();
      this._closeKeyForm();
      return;
    }
    if (this._open) {
      event.stopPropagation();
      this.close();
      this._toggleButton?.focus();
    }
  }

  /** @private */
  _t(key, vars = {}) {
    let text = this.messages[key] || key;
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value));
    }
    return text;
  }
}
