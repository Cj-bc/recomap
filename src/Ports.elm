port module Ports exposing
    ( requestLocation, receiveLocation
    , saveFavorites, loadFavorites
    )

import Data exposing (LatLng, PosterId(..), posterIdToString)


port requestLocation : () -> Cmd msg


-- 内部port: 独自型を通せないため String / レコードを使う

port receiveLocationRaw : (Maybe LatLng -> msg) -> Sub msg

port saveFavoritesRaw : List String -> Cmd msg

port loadFavoritesRaw : (List String -> msg) -> Sub msg


-- 公開API: PosterId / LatLng で完結する

receiveLocation : (Maybe LatLng -> msg) -> Sub msg
receiveLocation =
    receiveLocationRaw


saveFavorites : List PosterId -> Cmd msg
saveFavorites ids =
    saveFavoritesRaw (List.map posterIdToString ids)


loadFavorites : (List PosterId -> msg) -> Sub msg
loadFavorites toMsg =
    loadFavoritesRaw (List.map PosterId >> toMsg)