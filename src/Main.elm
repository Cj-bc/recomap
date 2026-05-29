module Main exposing (main)

import Browser
import Data exposing (..)
import Filter
import Html exposing (Html, button, div, input, text)
import Html.Attributes as Attr
import Html.Events as Events
import Http
import Json.Decode as Decode
import Json.Encode as Encode
import Ports
import RemoteData exposing (RemoteData(..), WebData)


main : Program () Model Msg
main =
    Browser.element
        { init = init, update = update, subscriptions = subscriptions, view = view }


-- MODEL

type alias Model =
    { db : WebData Database
    , center : LatLng
    , zoom : Int
    , flyTo : Maybe FlyTo
    , userLocation : Maybe LatLng
    , favoritePosters : List PosterId
    , selectedPlace : Maybe PlaceId
    , searchQuery : SearchQuery
    , favoritesOnly : Bool
    }


type alias FlyTo =
    { center : LatLng, zoom : Int, nonce : Int }


defaultCenter : LatLng
defaultCenter = { lat = 35.6812, lng = 139.7671 }


init : () -> ( Model, Cmd Msg )
init _ =
    ( { db = Loading
      , center = defaultCenter
      , zoom = 13
      , flyTo = Nothing
      , userLocation = Nothing
      , favoritePosters = []
      , selectedPlace = Nothing
      , searchQuery = { text = "", categories = [] }
      , favoritesOnly = False
      }
    , Http.get
        { url = "public/data.json"
        , expect = Http.expectJson (RemoteData.fromResult >> DataLoaded) databaseDecoder
        }
    )


-- UPDATE

type Msg
    = DataLoaded (WebData Database)
    | SearchTextChanged String
    | CategoryToggled Category
    | FavoriteToggled PosterId
    | FavoritesLoaded (List PosterId)
    | FavoritesOnlyToggled Bool
    | MarkerClicked String
    | LocationRequested
    | LocationReceived (Maybe LatLng)
    | DismissSelected


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        DataLoaded data ->
            ( { model | db = data }, Cmd.none )

        SearchTextChanged s ->
            let q = model.searchQuery in
            ( { model | searchQuery = { q | text = s } }, Cmd.none )

        CategoryToggled cat ->
            let
                q = model.searchQuery
                newCats =
                    if List.member cat q.categories then
                        List.filter ((/=) cat) q.categories
                    else
                        cat :: q.categories
            in
            ( { model | searchQuery = { q | categories = newCats } }, Cmd.none )

        FavoriteToggled pid ->
            let
                newFavs =
                    if List.member pid model.favoritePosters then
                        List.filter ((/=) pid) model.favoritePosters
                    else
                        pid :: model.favoritePosters
            in
            ( { model | favoritePosters = newFavs }
            , Ports.saveFavorites newFavs
            )

        FavoritesLoaded ids ->
            ( { model | favoritePosters = ids }, Cmd.none )

        FavoritesOnlyToggled b ->
            ( { model | favoritesOnly = b }, Cmd.none )

        MarkerClicked id ->
            ( { model | selectedPlace = Just (PlaceId id) }, Cmd.none )

        LocationRequested ->
            ( model, Ports.requestLocation () )

        LocationReceived (Just coords) ->
            ( { model
                | userLocation = Just coords
                , flyTo = Just { center = coords, zoom = 15, nonce = bumpNonce model.flyTo }
              }
            , Cmd.none
            )

        LocationReceived Nothing ->
            ( model, Cmd.none )

        DismissSelected ->
            ( { model | selectedPlace = Nothing }, Cmd.none )


bumpNonce : Maybe FlyTo -> Int
bumpNonce ft =
    case ft of
        Just f -> f.nonce + 1
        Nothing -> 0


-- SUBSCRIPTIONS

subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ Ports.receiveLocation LocationReceived
        , Ports.loadFavorites FavoritesLoaded
        ]


-- VIEW

view : Model -> Html Msg
view model =
    div [ Attr.class "app" ]
        [ viewSearchBar model
        , viewCategoryFilters model
        , viewMap model
        , viewSelectedPlace model
        ]


viewSearchBar : Model -> Html Msg
viewSearchBar model =
    div [ Attr.class "search-bar" ]
        [ input
            [ Attr.type_ "search"
            , Attr.placeholder "店名・住所で検索"
            , Attr.value model.searchQuery.text
            , Events.onInput SearchTextChanged
            ]
            []
        , button [ Events.onClick LocationRequested ] [ text "現在地" ]
        ]


viewCategoryFilters : Model -> Html Msg
viewCategoryFilters model =
    div [ Attr.class "filters" ]
        (List.map (viewCategoryChip model.searchQuery.categories) allCategories)


viewCategoryChip : List Category -> Category -> Html Msg
viewCategoryChip selected cat =
    button
        [ Attr.classList
            [ ( "chip", True )
            , ( "chip-on", List.member cat selected )
            ]
        , Events.onClick (CategoryToggled cat)
        ]
        [ text (categoryToLabel cat) ]


viewMap : Model -> Html Msg
viewMap model =
    let
        places =
            case model.db of
                Success db ->
                    Filter.applyFilters
                        { query = model.searchQuery
                        , favorites = model.favoritePosters
                        , favoritesOnly = model.favoritesOnly
                        }
                        db.places

                _ ->
                    []
    in
    Html.node "leaflet-map"
        [ Attr.attribute "initial-center" (latLngString model.center)
        , Attr.attribute "initial-zoom" (String.fromInt model.zoom)
        , Attr.property "markers" (encodeMarkers places)
        , Attr.property "flyTo" (encodeFlyTo model.flyTo)
        , Events.on "marker-click"
            (Decode.at [ "detail", "id" ] Decode.string
                |> Decode.map MarkerClicked
            )
        ]
        []


viewSelectedPlace : Model -> Html Msg
viewSelectedPlace model =
    case ( model.selectedPlace, model.db ) of
        ( Just pid, Success db ) ->
            case List.filter (\p -> p.id == pid) db.places |> List.head of
                Just place ->
                    div
                        [ Attr.class "place-detail"
                        , Attr.style "position" "fixed"
                        , Attr.style "left" "0"
                        , Attr.style "right" "0"
                        , Attr.style "bottom" "0"
                        , Attr.style "z-index" "1100"
                        , Attr.style "background" "white"
                        , Attr.style "padding" "16px 20px"
                        , Attr.style "box-shadow" "0 -2px 12px rgba(0,0,0,0.2)"
                        , Attr.style "border-radius" "12px 12px 0 0"
                        , Attr.style "max-height" "50vh"
                        , Attr.style "overflow-y" "auto"
                        ]
                        [ button
                            [ Attr.class "close"
                            , Events.onClick DismissSelected
                            , Attr.style "position" "absolute"
                            , Attr.style "top" "8px"
                            , Attr.style "right" "8px"
                            , Attr.style "border" "none"
                            , Attr.style "background" "transparent"
                            , Attr.style "font-size" "24px"
                            , Attr.style "cursor" "pointer"
                            ]
                            [ text "×" ]
                        , Html.h2 [] [ text place.name ]
                        , Html.p [ Attr.class "address" ] [ text place.address ]
                        , Html.p [ Attr.class "category" ]
                            [ text (categoryToLabel place.category) ]
                        , div [ Attr.class "mentions" ]
                            (List.map (viewMention db) place.mentions)
                        ]

                Nothing -> text ""

        _ -> text ""


viewMention : Database -> Mention -> Html Msg
viewMention db m =
    let
        posterName =
            db.posters
                |> List.filter (\p -> p.id == m.posterId)
                |> List.head
                |> Maybe.map .name
                |> Maybe.withDefault (posterIdToString m.posterId)
    in
    Html.a
        [ Attr.href m.url
        , Attr.target "_blank"
        , Attr.rel "noopener"
        ]
        [ text (posterName ++ " の動画を見る") ]


-- ENCODERS

latLngString : LatLng -> String
latLngString p =
    String.fromFloat p.lat ++ "," ++ String.fromFloat p.lng


encodeMarker : Place -> Encode.Value
encodeMarker p =
    Encode.object
        [ ( "id", Encode.string (placeIdToString p.id) )
        , ( "name", Encode.string p.name )
        , ( "lat", Encode.float p.location.lat )
        , ( "lng", Encode.float p.location.lng )
        , ( "category", Encode.string (categoryToString p.category) )
        ]

encodeMarkers : List Place -> Encode.Value
encodeMarkers places =
    Encode.list encodeMarker places

encodeFlyTo : Maybe FlyTo -> Encode.Value
encodeFlyTo ft =
    case ft of
        Nothing -> Encode.null
        Just f ->
            Encode.object
                [ ( "lat", Encode.float f.center.lat )
                , ( "lng", Encode.float f.center.lng )
                , ( "zoom", Encode.int f.zoom )
                , ( "nonce", Encode.int f.nonce )
                ]