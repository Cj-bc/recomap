{ pkgs }:

let
  tarball = pkgs.fetchurl {
    url = "https://registry.npmjs.org/leaflet.markercluster/-/leaflet.markercluster-1.5.3.tgz";
    hash = "sha256-/GsLHQC2xwiuVOQ+5KEaw0XkFmDhnwpXAZC7Nbq7Ghw=";
  };
in
pkgs.runCommand "leaflet-markercluster-1.5.3" { } ''
  mkdir -p $out
  tar -xzf ${tarball} --strip-components=2 -C $out \
    package/dist/MarkerCluster.css \
    package/dist/MarkerCluster.Default.css \
    package/dist/leaflet.markercluster.js
''
