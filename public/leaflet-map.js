class LeafletMap extends HTMLElement {
  static get observedAttributes() {
    return ['initial-center', 'initial-zoom'];
  }

  constructor() {
    super();
    this._map = null;
    this._cluster = null;
    this._markersData = [];
    this._flyToData = null;
    this._lastFlyToNonce = null;
  }

  connectedCallback() {
    if (this._map) return;

    const center = this._parseInitialCenter();
    const zoom = parseInt(this.getAttribute('initial-zoom') || '13', 10);

    this._map = L.map(this).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this._map);

    this._cluster = L.markerClusterGroup();
    this._map.addLayer(this._cluster);

    this._setupDoubleTapZoom();

    this._renderMarkers();
    this._applyFlyTo();
  }

  _setupDoubleTapZoom() {
    // State for double-tap-hold detection
    let lastTapTime = 0;
    let lastTapY = 0;
    let doubleTapActive = false;
    let startY = 0;
    let startZoom = 0;
    // Sensitivity: pixels per zoom level
    const PIXELS_PER_ZOOM = 80;
    const DOUBLE_TAP_DELAY = 300;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) {
        doubleTapActive = false;
        return;
      }

      const touch = e.touches[0];
      const now = Date.now();
      const dy = Math.abs(touch.clientY - lastTapY);

      if (now - lastTapTime < DOUBLE_TAP_DELAY && dy < 30) {
        // Second tap detected — begin double-tap-hold zoom
        doubleTapActive = true;
        startY = touch.clientY;
        startZoom = this._map.getZoom();

        // Disable map drag during gesture
        this._map.dragging.disable();
        // Prevent the default double-tap zoom Leaflet would do
        e.preventDefault();
        e.stopPropagation();
      } else {
        doubleTapActive = false;
      }

      lastTapTime = now;
      lastTapY = touch.clientY;
    };

    const onTouchMove = (e) => {
      if (!doubleTapActive || e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      // Drag up → zoom in, drag down → zoom out (matches Google Maps)
      const delta = (startY - touch.clientY) / PIXELS_PER_ZOOM;
      const newZoom = Math.max(1, Math.min(19, startZoom + delta));
      this._map.setZoom(newZoom, { animate: false });
    };

    const onTouchEnd = (e) => {
      if (!doubleTapActive) return;
      doubleTapActive = false;
      this._map.dragging.enable();
    };

    // Use capture to intercept before Leaflet's own handlers
    this.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    this.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    this.addEventListener('touchend', onTouchEnd, { capture: true });
    this.addEventListener('touchcancel', onTouchEnd, { capture: true });
  }

  disconnectedCallback() {
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  }

  // Elm から Attr.property "markers" で渡される
  set markers(value) {
    this._markersData = Array.isArray(value) ? value : [];
    if (this._map) this._renderMarkers();
  }
  get markers() { return this._markersData; }

  // Elm から Attr.property "flyTo" で渡される。nonce で多重起動を防ぐ
  set flyTo(value) {
    this._flyToData = value;
    if (this._map) this._applyFlyTo();
  }
  get flyTo() { return this._flyToData; }

  _parseInitialCenter() {
    const raw = this.getAttribute('initial-center') || '35.6812,139.7671';
    const [lat, lng] = raw.split(',').map(parseFloat);
    return [lat, lng];
  }

  _renderMarkers() {
    if (!this._cluster) return;
    this._cluster.clearLayers();
    for (const m of this._markersData) {
      const marker = L.marker([m.lat, m.lng], { title: m.name });
      marker.bindTooltip(m.name);
      marker.on('click', () => {
        this.dispatchEvent(new CustomEvent('marker-click', {
          detail: { id: m.id },
        }));
      });
      this._cluster.addLayer(marker);
    }
  }

  _applyFlyTo() {
    const ft = this._flyToData;
    if (!ft || !this._map) return;
    if (ft.nonce === this._lastFlyToNonce) return;
    this._lastFlyToNonce = ft.nonce;
    this._map.flyTo([ft.lat, ft.lng], ft.zoom || this._map.getZoom());
  }
}

customElements.define('leaflet-map', LeafletMap);
