import { Handler } from '../core/Handler.js';
import { Point } from '../core/Point.js';
import {
  addClass,
  disableTextSelection,
  enableTextSelection,
  getMousePosition,
  off,
  on,
  preventDefault,
  removeClass,
  stopPropagation,
} from '../util/dom.js';
import { cancelAnimFrame, clamp, requestAnimFrame } from '../util/index.js';

const DRAG_THRESHOLD = 3;
const SAMPLE_WINDOW = 120;

/**
 * Mouse and touch panning with kinetic inertia.
 *
 * The handler updates the committed map centre on every animation frame. This
 * keeps tiles, markers and vectors consistent without a second coordinate
 * system, and makes interruption by a new gesture predictable.
 */
export class DragHandler extends Handler {
  /** @private */
  _enable() {
    addClass(this._map.getContainer(), 'sweety-grab');
    this._onPointerDown = (event) => this._handlePointerDown(event);
    this._onPointerMove = (event) => this._handlePointerMove(event);
    this._onPointerUp = (event) => this._handlePointerUp(event);
    this._onKeyDown = (event) => {
      if (event.key === 'Escape') {
        this._finishDrag(event);
        this._map._moveEnd(false);
      }
    };
    on(this._map.getContainer(), 'pointerdown', this._onPointerDown);
  }

  /** @private */
  _disable() {
    removeClass(this._map.getContainer(), 'sweety-grab');
    off(this._map.getContainer(), 'pointerdown', this._onPointerDown);
    this._detachDocumentListeners();
    this._cancelInertia();
    if (this._dragging) {
      this._finishDrag();
      this._map._moveEnd(false);
    }
    enableTextSelection();
  }

  /** @private */
  _handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this._map._pinching) return;

    const target = event.target;
    if (
      target &&
      target.closest &&
      target.closest('.sweety-marker, .sweety-control, .sweety-popup, .sweety-tooltip')
    ) {
      return;
    }

    if (this._inertiaVelocity) {
      this._cancelInertia();
      this._map._moveEnd(false);
    }
    this._startPoint = new Point(getMousePosition(event, this._map.getContainer()));
    this._startCenter = this._map.getCenter();
    this._startZoom = this._map.getZoom();
    this._pointerId = event.pointerId ?? 1;
    this._dragging = false;
    this._moved = false;
    this._samples = [{ time: performance.now(), ...this._startPoint }];

    if (this._map.getContainer().setPointerCapture && event.pointerId !== undefined) {
      try {
        this._map.getContainer().setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture is an optimisation, not a requirement */
      }
    }

    on(document, 'pointermove', this._onPointerMove, { passive: false });
    on(document, 'pointerup pointercancel', this._onPointerUp);
    on(document, 'keydown', this._onKeyDown);
  }

  /** @private */
  _handlePointerMove(event) {
    if (event.pointerId !== undefined && event.pointerId !== this._pointerId) return;
    if (this._map._pinching) return;

    const point = new Point(getMousePosition(event, this._map.getContainer()));
    const delta = point.subtract(this._startPoint);

    if (!this._dragging) {
      if (delta.distanceTo(new Point(0, 0)) < DRAG_THRESHOLD) return;
      this._dragging = true;
      this._map._dragging = true;
      addClass(this._map.getContainer(), 'sweety-dragging');
      disableTextSelection();
      this._map._moveStart(false);
      this._map.fire('dragstart', {
        originalEvent: event,
        latlng: this._map.containerPointToLatLng(this._startPoint),
      });
    }

    preventDefault(event);
    stopPropagation(event);
    this._moved = true;

    const now = performance.now();
    this._samples.push({ time: now, ...point });
    while (this._samples.length > 2 && now - this._samples[0].time > SAMPLE_WINDOW) {
      this._samples.shift();
    }

    const center = this._map.unproject(
      this._map.project(this._startCenter, this._startZoom).subtract(delta),
      this._startZoom,
    );
    this._map._moveDuringDrag(center);
    this._map.fire('drag', {
      originalEvent: event,
      latlng: this._map.containerPointToLatLng(point),
      containerPoint: point,
    });
  }

  /** @private */
  _handlePointerUp(event) {
    if (event.pointerId !== undefined && event.pointerId !== this._pointerId) return;
    if (!this._dragging) {
      this._detachDocumentListeners();
      return;
    }

    const velocity = this._computeVelocity();
    this._finishDrag(event, false);
    if (
      this._map.options.inertia &&
      velocity &&
      Math.hypot(velocity.x, velocity.y) > 40 &&
      !this._map._pinching
    ) {
      this._startInertia(velocity);
    } else {
      this._map._moveEnd(false);
    }
  }

  /** @private */
  _finishDrag(event, silent = false) {
    if (!this._dragging && !this._moved) {
      this._detachDocumentListeners();
      return;
    }

    const wasDragging = this._dragging;
    this._dragging = false;
    this._moved = false;
    this._map._dragging = false;
    if (wasDragging) {
      removeClass(this._map.getContainer(), 'sweety-dragging');
      enableTextSelection();
      this._map._suppressClick();
      if (!silent) {
        this._map.fire('dragend', {
          originalEvent: event,
          latlng: this._map.getCenter(),
        });
      }
    }
    this._detachDocumentListeners();
    this._releasePointerCapture(event);
  }

  /** @private */
  _computeVelocity() {
    if (!this._samples || this._samples.length < 2) return null;
    const first = this._samples[0];
    const last = this._samples[this._samples.length - 1];
    const elapsed = Math.max(1, last.time - first.time);
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) return null;

    const speed = clamp(
      (distance / elapsed) * 1000,
      0,
      Number(this._map.options.inertiaMaxSpeed) || 1500,
    );
    // Pointer movement is inverted: the map follows the finger.
    return { x: (-dx / distance) * speed, y: (-dy / distance) * speed };
  }

  /** @private */
  _startInertia(velocity) {
    this._inertiaVelocity = velocity;
    this._inertiaLastTime = performance.now();
    this._inertiaStillFrames = 0;
    this._inertiaFrame = requestAnimFrame((time) => this._stepInertia(time));
  }

  /** @private */
  _stepInertia(time) {
    if (!this._inertiaVelocity) return;
    const dt = Math.min(32, Math.max(1, time - this._inertiaLastTime)) / 1000;
    this._inertiaLastTime = time;

    const speed = Math.hypot(this._inertiaVelocity.x, this._inertiaVelocity.y);
    const deceleration = Number(this._map.options.inertiaDeceleration) || 3000;
    const nextSpeed = Math.max(0, speed - deceleration * dt);

    if (nextSpeed <= 0 || speed === 0) {
      this._endInertia();
      return;
    }

    const step = this._inertiaVelocity;
    const dx = (step.x / speed) * nextSpeed * dt;
    const dy = (step.y / speed) * nextSpeed * dt;

    const center = this._map.unproject(
      this._map.project(this._map.getCenter()).add(new Point(dx, dy)),
      this._map.getZoom(),
    );
    const moved = this._map._moveDuringDrag(center);
    this._inertiaStillFrames = moved ? 0 : this._inertiaStillFrames + 1;
    this._inertiaVelocity = { x: (step.x / speed) * nextSpeed, y: (step.y / speed) * nextSpeed };

    if (this._inertiaStillFrames > 2) {
      this._endInertia();
      return;
    }
    this._inertiaFrame = requestAnimFrame((nextTime) => this._stepInertia(nextTime));
  }

  /** @private */
  _endInertia() {
    this._cancelInertia();
    this._map._moveEnd(false);
  }

  /** @private */
  _cancelInertia() {
    if (this._inertiaFrame) {
      cancelAnimFrame(this._inertiaFrame);
      this._inertiaFrame = null;
    }
    this._inertiaVelocity = null;
  }

  /** @private */
  _detachDocumentListeners() {
    off(document, 'pointermove', this._onPointerMove);
    off(document, 'pointerup pointercancel', this._onPointerUp);
    off(document, 'keydown', this._onKeyDown);
  }

  /** @private */
  _releasePointerCapture(event) {
    const container = this._map.getContainer();
    if (container.releasePointerCapture && event && event.pointerId !== undefined) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore stale pointer ids */
      }
    }
  }
}
