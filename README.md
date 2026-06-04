# 配信スポットマップ

配信者向けの配信スポット情報を地図上で確認できるWebアプリケーションです。

## Third-party components

このリポジトリには以下のサードパーティコンポーネントが含まれています。

| コンポーネント | バージョン | ライセンス | ライセンス全文 |
|---|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | BSD-2-Clause | [LICENSES/BSD-2-Clause.txt](LICENSES/BSD-2-Clause.txt) |
| [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) | 1.5.3 | MIT | [LICENSES/MIT.txt](LICENSES/MIT.txt) |

これらのファイルは `public/vendor/` に配置されており、元のライセンス条件に従って配布されています。

## ベンダーファイルの更新

`public/vendor/` 内のファイルはNixで管理されています。バージョンを更新する場合は `flake.nix` の該当URLとハッシュを変更してから以下を実行してください。

```bash
nix run .#vendor
```
