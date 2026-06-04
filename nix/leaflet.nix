{ pkgs }:

let
  tarball = pkgs.fetchurl {
    url = "https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz";
    hash = "sha256-hMZaJW5QZXiW9UwzvYV7aEnr6UyBeAO+gYvzKj3eC3c=";
  };
in
pkgs.runCommand "leaflet-1.9.4" { } ''
  mkdir -p $out
  tar -xzf ${tarball} --strip-components=2 -C $out \
    package/dist/leaflet.css \
    package/dist/leaflet.js
''
