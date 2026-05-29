module Data exposing
    ( PosterId(..), PlaceId(..)
    , Platform(..), Poster
    , Category(..), Mention, Place
    , SearchQuery, Database, LatLng
    , allCategories, categoryToString, categoryToLabel
    , posterIdToString, placeIdToString
    , databaseDecoder
    )

import Json.Decode as Decode exposing (Decoder)
import Json.Decode.Pipeline exposing (required, optional, custom)

type PosterId = PosterId String
type PlaceId = PlaceId String

posterIdToString : PosterId -> String
posterIdToString (PosterId id) = id

placeIdToString : PlaceId -> String
placeIdToString (PlaceId id) = id


type alias LatLng = { lat : Float, lng : Float }


type Platform
    = YouTube String
    | Twitch String
    | TikTok String
    | XPlatform String
    | OtherPlatform { name : String, profileUrl : String }


type alias Poster =
    { id : PosterId, name : String, platforms : List Platform }


type Category
    = Restaurant | Cafe | Shop | Exhibition | Activity | Etc


allCategories : List Category
allCategories = [ Restaurant, Cafe, Shop, Exhibition, Activity, Etc ]


categoryToString : Category -> String
categoryToString cat =
    case cat of
        Restaurant -> "restaurant"
        Cafe -> "cafe"
        Shop -> "shop"
        Exhibition -> "exhibition"
        Activity -> "activity"
        Etc -> "etc"


categoryToLabel : Category -> String
categoryToLabel cat =
    case cat of
        Restaurant -> "飲食店"
        Cafe -> "カフェ"
        Shop -> "ショップ"
        Exhibition -> "展示・観光"
        Activity -> "アクティビティ"
        Etc -> "その他"


type alias Mention =
    { posterId : PosterId, url : String, timestampSec : Maybe Int }


type alias Place =
    { id : PlaceId
    , name : String
    , address : String
    , location : LatLng
    , category : Category
    , mentions : List Mention
    }


type alias SearchQuery =
    { text : String, categories : List Category }


type alias Database =
    { posters : List Poster, places : List Place }


-- DECODERS

databaseDecoder : Decoder Database
databaseDecoder =
    Decode.succeed Database
        |> required "posters" (Decode.list posterDecoder)
        |> required "places" (Decode.list placeDecoder)


posterDecoder : Decoder Poster
posterDecoder =
    Decode.succeed Poster
        |> required "id" (Decode.map PosterId Decode.string)
        |> required "name" Decode.string
        |> required "platforms" (Decode.list platformDecoder)


platformDecoder : Decoder Platform
platformDecoder =
    Decode.field "kind" Decode.string
        |> Decode.andThen
            (\kind ->
                case kind of
                    "youtube" ->
                        Decode.map YouTube (Decode.field "profileUrl" Decode.string)
                    "twitch" ->
                        Decode.map Twitch (Decode.field "profileUrl" Decode.string)
                    "tiktok" ->
                        Decode.map TikTok (Decode.field "profileUrl" Decode.string)
                    "x" ->
                        Decode.map XPlatform (Decode.field "profileUrl" Decode.string)
                    "other" ->
                        Decode.map2
                            (\n u -> OtherPlatform { name = n, profileUrl = u })
                            (Decode.field "name" Decode.string)
                            (Decode.field "profileUrl" Decode.string)
                    _ ->
                        Decode.fail ("Unknown platform kind: " ++ kind)
            )


categoryDecoder : Decoder Category
categoryDecoder =
    Decode.string
        |> Decode.andThen
            (\s ->
                case s of
                    "restaurant" -> Decode.succeed Restaurant
                    "cafe" -> Decode.succeed Cafe
                    "shop" -> Decode.succeed Shop
                    "exhibition" -> Decode.succeed Exhibition
                    "activity" -> Decode.succeed Activity
                    "etc" -> Decode.succeed Etc
                    other -> Decode.fail ("Unknown category: " ++ other)
            )


mentionDecoder : Decoder Mention
mentionDecoder =
    Decode.succeed Mention
        |> required "posterId" (Decode.map PosterId Decode.string)
        |> required "url" Decode.string
        |> optional "timestampSec" (Decode.nullable Decode.int) Nothing

latLngFlatDecoder : Decoder LatLng
latLngFlatDecoder =
    Decode.map2 LatLng
        (Decode.field "lat" Decode.float)
        (Decode.field "lng" Decode.float)

placeDecoder : Decoder Place
placeDecoder =
    Decode.succeed Place
        |> required "id" (Decode.map PlaceId Decode.string)
        |> required "name" Decode.string
        |> required "address" Decode.string
        |> custom latLngFlatDecoder
        |> required "category" categoryDecoder
        |> required "mentions" (Decode.list mentionDecoder)