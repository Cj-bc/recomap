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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this._map);

    this._cluster = L.markerClusterGroup();
    this._map.addLayer(this._cluster);

    this._setupDoubleTapZoom();

    this._renderMarkers();
    this._applyFlyTo();
  }

  _setupDoubleTapZoom() {
    let lastTapTime = 0;
    let lastTapY = 0;
    let doubleTapActive = false;
    let startY = 0;
    let startZoom = 0;
    let currentZoom = 0;
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
        doubleTapActive = true;
        startY = touch.clientY;
        startZoom = this._map.getZoom();
        currentZoom = startZoom;
        // タップ位置を地図座標に変換して拡縮の中心に固定
        this._zoomCenter = this._map.containerPointToLatLng(
          L.point(touch.clientX - this.getBoundingClientRect().left,
                  touch.clientY - this.getBoundingClientRect().top)
        );

        this._map.dragging.disable();
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
      const delta = (startY - touch.clientY) / PIXELS_PER_ZOOM;
      currentZoom = Math.max(1, Math.min(19, startZoom + delta));

      // Use the same CSS-transform path as pinch zoom — no tile reload during drag
      this._map._animateZoom(this._zoomCenter, currentZoom, false, true);
    };

    const onTouchEnd = (e) => {
      if (!doubleTapActive) return;
      doubleTapActive = false;
      this._map.dragging.enable();

      // Snap to final zoom with smooth animation (tiles reload once here)
      const finalZoom = this._map._limitZoom(currentZoom);
      this._map._animateZoom(this._zoomCenter, finalZoom, true, true);
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
