{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
  };

  outputs = { nixpkgs, ... }:
      let
        eachSystems = systems: op:
          builtins.zipAttrsWith (name: values: builtins.foldl' (acc: v: acc // v) {} values) (builtins.map op systems);

      in eachSystems ["x86_64-linux" "aarch64-linux"] (system:
        let
          pkgs = import nixpkgs { inherit system; };
          leaflet = pkgs.callPackage ./nix/leaflet.nix { };
          markercluster = pkgs.callPackage ./nix/leaflet-markercluster.nix { };
          elmTools = with pkgs.elmPackages; [
            elm
            elm-format
            elm-json
            elm-review
            elm-test
            elm-verify-examples
          ];
        in {
          devShells.${system}.default = pkgs.mkShell {
            buildInputs = with pkgs; elmTools ++ [ deno ];
          };

          apps.${system} = {
            make = {
              type = "app";
              program = toString (pkgs.writeShellScript
                "make"
                "${pkgs.elmPackages.elm}/bin/elm make --output=elm.js src/Main.elm"
              );
            };
            format = {
              type = "app";
              program = toString (pkgs.writeShellScript "format-css" ''
                ${pkgs.deno}/bin/deno fmt style.css
              '');
            };
            vendor = {
              type = "app";
              program = toString (pkgs.writeShellScript "vendor" ''
                mkdir -p public/vendor
                cp ${leaflet}/* public/vendor/
                cp ${markercluster}/* public/vendor/
              '');
            };
          };
        }
      );
}
