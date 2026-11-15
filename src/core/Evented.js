let eventId = 0;

/**
 * Event object passed to listeners.
 *
 * `target` is the object that fired the event, while `sourceTarget` remains
 * the original object when an event bubbles through a LayerGroup.
 */
export class Event {
  /**
   * @param {string} type
   * @param {object} target
   * @param {object} [data]
   */
  constructor(type, target, data = {}) {
    /** @type {string} */
    this.type = type;
    /** @type {object} */
    this.target = target;
    /** @type {object} */
    this.sourceTarget = target;
    /** @type {object|null} */
    this.propagatedFrom = null;
    /** @type {object|null} */
    this.layer = target && target._map ? target : null;
    /** @type {number} */
    this.id = ++eventId;

    if (data && typeof data === 'object') Object.assign(this, data);
  }
}

/**
 * Lightweight event emitter used by maps, layers, handlers and controls.
 * Supports DOM-like namespaces (`map click`), `once`, contexts and bubbling
 * through event parents.
 */
export class Evented {
  /**
   * Register a listener. `types` may be space-separated and `fn` may be an
   * object map of `{ type: handler }`.
   * @param {string|Record<string, Function>} types
   * @param {Function} [fn]
   * @param {object} [context=this]
   * @returns {this}
   */
  on(types, fn, context = this) {
    if (!types) return this;

    if (typeof types === 'object') {
      for (const [type, handler] of Object.entries(types)) {
        this.on(type, handler, fn || context);
      }
      return this;
    }

    if (typeof fn !== 'function') {
      throw new TypeError('Evented.on expects a listener function');
    }

    if (!this._events) this._events = Object.create(null);

    for (const type of String(types).split(/\s+/).filter(Boolean)) {
      const listeners = this._events[type] || (this._events[type] = []);
      if (listeners.some((entry) => entry.fn === fn && entry.ctx === context)) continue;
      listeners.push({ fn, ctx: context, once: false });
    }
    return this;
  }

  /**
   * Remove a previously registered listener. Calling without `fn` removes
   * every listener for the given types.
   * @param {string} [types]
   * @param {Function} [fn]
   * @param {object} [context]
   * @returns {this}
   */
  off(types, fn, context) {
    if (!types) {
      this._events = Object.create(null);
      return this;
    }
    if (!this._events) return this;

    for (const type of String(types).split(/\s+/).filter(Boolean)) {
      const listeners = this._events[type];
      if (!listeners) continue;

      if (!fn) {
        delete this._events[type];
        continue;
      }

      const filtered = listeners.filter(
        (entry) => entry.fn !== fn || (context !== undefined && entry.ctx !== context),
      );
      if (filtered.length) {
        this._events[type] = filtered;
      } else {
        delete this._events[type];
      }
    }
    return this;
  }

  /**
   * Register a listener that removes itself after the first call.
   * @param {string} types
   * @param {Function} fn
   * @param {object} [context=this]
   * @returns {this}
   */
  once(types, fn, context = this) {
    if (typeof fn !== 'function') {
      throw new TypeError('Evented.once expects a listener function');
    }
    const wrapper = (...args) => {
      this.off(types, wrapper, context);
      return fn.apply(context, args);
    };
    wrapper._original = fn;
    return this.on(types, wrapper, context);
  }

  /**
   * Emit an event.
   * @param {string} type
   * @param {object} [data]
   * @param {boolean} [propagate=true] bubble to registered event parents
   * @returns {this}
   */
  fire(type, data = {}, propagate = true) {
    if (!type) return this;

    const event = data instanceof Event ? data : new Event(type, this, data);

    // Snapshot listeners so handlers can safely unsubscribe during dispatch.
    const listeners = this._events && this._events[type] ? this._events[type].slice() : [];
    for (const entry of listeners) {
      if (entry.once) this.off(type, entry.fn, entry.ctx);
      entry.fn.call(entry.ctx, event);
    }

    if (propagate) this._propagateEvent(event);
    return this;
  }

  /**
   * Whether at least one listener (optionally including event parents) exists.
   * @param {string} type
   * @param {boolean} [propagate=false]
   * @returns {boolean}
   */
  listens(type, propagate = false) {
    const own = Boolean(this._events && this._events[type] && this._events[type].length);
    if (own || !propagate || !this._eventParents) return own;
    return Object.values(this._eventParents).some((parent) => parent.listens(type, true));
  }

  /**
   * Register an event parent. Events bubble to parents unless they have
   * already visited that parent.
   * @param {Evented} parent
   * @returns {this}
   */
  addEventParent(parent) {
    if (!parent) return this;
    if (!this._eventParents) this._eventParents = Object.create(null);
    this._eventParents[parent._sweetyId || (parent._sweetyId = ++eventId)] = parent;
    return this;
  }

  /**
   * Remove an event parent.
   * @param {Evented} parent
   * @returns {this}
   */
  removeEventParent(parent) {
    if (this._eventParents && parent) {
      delete this._eventParents[parent._sweetyId];
    }
    return this;
  }

  /**
   * Bubble an event to all registered parents.
   * @param {Event} event
   * @private
   */
  _propagateEvent(event) {
    if (!this._eventParents) return;

    const visited = event._propagationParents || (event._propagationParents = new Set());
    if (visited.has(this)) return;
    visited.add(this);

    for (const parent of Object.values(this._eventParents)) {
      if (visited.has(parent)) continue;
      event.propagatedFrom = this;
      event.layer = this;
      parent.fire(event.type, event, true);
    }
  }
}
