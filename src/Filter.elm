module Filter exposing (FilterContext, applyFilters)

import Data exposing (..)


type alias FilterContext =
    { query : SearchQuery
    , favorites : List PosterId
    , favoritesOnly : Bool
    }


applyFilters : FilterContext -> List Place -> List Place
applyFilters ctx places =
    places
        |> List.filter (matchesCategory ctx.query)
        |> List.filter (matchesText ctx.query)
        |> (if ctx.favoritesOnly then
                List.filter (mentionedByAny ctx.favorites)
            else
                identity
           )


matchesCategory : SearchQuery -> Place -> Bool
matchesCategory query place =
    case query.categories of
        [] -> True
        cats -> List.member place.category cats


matchesText : SearchQuery -> Place -> Bool
matchesText query place =
    let
        needle = String.toLower (String.trim query.text)
    in
    if String.isEmpty needle then
        True
    else
        String.contains needle (String.toLower place.name)
            || String.contains needle (String.toLower place.address)


mentionedByAny : List PosterId -> Place -> Bool
mentionedByAny favs place =
    List.any (\m -> List.member m.posterId favs) place.mentions