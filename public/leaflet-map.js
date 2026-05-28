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

  _applyFlyTo() {
    const ft = this._flyToData;
    if (!ft || !this._map) return;
    if (ft.nonce === this._lastFlyToNonce) return;
    this._lastFlyToNonce = ft.nonce;
    this._map.flyTo([ft.lat, ft.lng], ft.zoom || this._map.getZoom());
  }
}

customElements.define('leaflet-map', LeafletMap);
