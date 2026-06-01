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

    this._initDoubleTapHoldZoom();
    this._renderMarkers();
    this._applyFlyTo();
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

  _initDoubleTapHoldZoom() {
    const mapEl = this;
    let lastTapTime = 0;
    let isHolding = false;
    let tapContainerPoint = null;
    let startY = 0;
    let startZoom = 0;

    const DOUBLE_TAP_MS = 300;
    const ZOOM_SENSITIVITY = 0.02; // zoom levels per pixel

    mapEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        isHolding = false;
        return;
      }

      const now = Date.now();
      const touch = e.touches[0];

      if (now - lastTapTime < DOUBLE_TAP_MS) {
        e.preventDefault();
        isHolding = true;
        startY = touch.clientY;
        startZoom = this._map.getZoom();

        const rect = mapEl.getBoundingClientRect();
        tapContainerPoint = L.point(
          touch.clientX - rect.left,
          touch.clientY - rect.top
        );

        this._map.dragging.disable();
      } else {
        isHolding = false;
      }

      lastTapTime = now;
    }, { passive: false });

    mapEl.addEventListener('touchmove', (e) => {
      if (!isHolding || e.touches.length !== 1) return;
      e.preventDefault();

      const touch = e.touches[0];
      const deltaY = startY - touch.clientY; // 上方向 = 正 = ズームイン
      const newZoom = startZoom + deltaY * ZOOM_SENSITIVITY;

      // タップした地点が画面上の同じ位置に留まるよう中心を計算
      const tapLatLng = this._map.containerPointToLatLng(tapContainerPoint);
      const tapProjNew = this._map.project(tapLatLng, newZoom);
      const halfSize = this._map.getSize().divideBy(2);
      const newCenter = this._map.unproject(
        tapProjNew.subtract(tapContainerPoint).add(halfSize),
        newZoom
      );

      this._map.setView(newCenter, newZoom, { animate: false });
    }, { passive: false });

    const endHold = () => {
      if (!isHolding) return;
      isHolding = false;
      this._map.dragging.enable();
    };

    mapEl.addEventListener('touchend', endHold);
    mapEl.addEventListener('touchcancel', endHold);
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
