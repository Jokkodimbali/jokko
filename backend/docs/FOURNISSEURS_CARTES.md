# Fournisseurs de cartes : Google et Geoapify

Jokko conserve les deux fournisseurs. Le choix se fait **uniquement côté backend** avec `MAP_PROVIDER` dans `backend/.env` en local, ou dans les variables d'environnement de l'hébergement. Le frontend lit `GET /api/v1/maps/config` et utilise le fournisseur sélectionné. Les écrans de réservation, de recherche, de pharmacie, de magasin et de suivi continuent d'appeler les mêmes endpoints `/maps` pour les adresses et les itinéraires. Le code Google reste en place quand Geoapify est actif.

| Valeur de `MAP_PROVIDER` | Carte dans le navigateur | Géocodage et itinéraires côté backend |
| --- | --- | --- |
| `geoapify` | Leaflet et tuiles Geoapify | API Geoapify |
| `google` | Maps JavaScript et Places | API Geocoding et Routes de Google |

La valeur par défaut est `google` si `MAP_PROVIDER` est absente. Le choix n'est pas modifiable à chaud : **redémarrer le backend et recharger entièrement le frontend** après chaque bascule. La configuration chargée par le navigateur reste en cache pendant la vie de la page.

## Passer de Geoapify à Google

1. Dans [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/overview), sélectionner le projet qui porte les clés Google, rétablir la facturation et vérifier que Maps JavaScript API, Places API, Geocoding API et Routes API sont activées. Si Google affiche `BillingNotEnabledMapError`, la bascule de `MAP_PROVIDER` ne suffit pas : la facturation du projet doit être réactivée.
2. Renseigner les clés Google **distinctes** ci-dessous. La clé serveur est utilisée uniquement par le backend. La clé navigateur sert au chargement de Maps JavaScript et Places. Restreindre la clé navigateur aux domaines autorisés (HTTP referrers) et aux API nécessaires ; restreindre la clé serveur aux API serveur et, si possible, à l'IP sortante du backend.
3. Pour les marqueurs avancés, renseigner un Map ID Google de type JavaScript. `DEMO_MAP_ID` est un repli de développement, pas la configuration attendue en production.
4. Modifier `MAP_PROVIDER`, sauvegarder le fichier, redémarrer le backend, puis recharger la page Angular (au besoin avec un rechargement forcé).

```dotenv
MAP_PROVIDER=google
GOOGLE_MAPS_API_KEY=<cle-serveur-google>
GOOGLE_MAPS_BROWSER_API_KEY=<cle-navigateur-google>
GOOGLE_MAPS_MAP_ID=<map-id-google>
```

**État local lors de la rédaction :** `GOOGLE_MAPS_API_KEY` est renseignée dans `backend/.env`, mais `GOOGLE_MAPS_BROWSER_API_KEY` et `GOOGLE_MAPS_MAP_ID` ne le sont pas. En développement, le code peut utiliser la clé serveur Google comme repli navigateur ; cela ne remplace pas une clé navigateur correctement restreinte et peut échouer selon les restrictions de la clé. En production, ce repli est désactivé. Ne supprimez pas les clés Geoapify : elles resteront disponibles pour la prochaine bascule.

La configuration et la facturation exigées par Google sont décrites dans la [documentation Maps JavaScript](https://developers.google.com/maps/documentation/javascript/get-api-key), le [guide de dépannage](https://developers.google.com/maps/documentation/javascript/troubleshooting) et le [guide des marqueurs avancés](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## Passer de Google à Geoapify

1. Créer un projet dans [Geoapify MyProjects](https://myprojects.geoapify.com/). Une première clé est créée automatiquement ; dans **API keys**, en créer une seconde pour séparer les usages serveur et navigateur. Ce sont deux clés API ordinaires du même projet, sans type spécial, et elles partagent le quota du projet.
2. Réserver une clé au backend (géocodage, suggestions, itinéraires) et l'autre aux tuiles affichées par Leaflet. La clé navigateur est visible par l'utilisateur : la restreindre avec **Allowed HTTP referrers** aux domaines du frontend, y compris l'adresse locale utilisée en développement. Restreindre la clé serveur à l'IP sortante si celle-ci est stable. La configuration CORS seule ne protège pas une clé.
3. Renseigner les variables ci-dessous, puis redémarrer le backend et recharger entièrement le frontend. Le backend refuse de démarrer en mode Geoapify si l'une des deux clés manque.

```dotenv
MAP_PROVIDER=geoapify
GEOAPIFY_API_KEY=<cle-serveur-geoapify>
GEOAPIFY_BROWSER_API_KEY=<cle-navigateur-geoapify>
```

Ne placer aucune de ces valeurs dans les fichiers Angular, la documentation ou Git. `backend/.env` est ignoré par Git ; dans un déploiement, configurer les mêmes variables directement sur l'hébergement. Voir le [guide officiel des clés Geoapify](https://myprojects.geoapify.com/help/api-keys/).

## Vérifier une bascule

Depuis `backend/`, lancer le backend avec `npm run start:dev` ou redémarrer le processus déjà lancé. Son terminal doit indiquer qu'il écoute sur le port configuré. Ensuite, vérifier `http://localhost:3000/api/v1/maps/config` : le champ `data.provider` doit valoir `google` ou `geoapify` selon `MAP_PROVIDER`. Cet endpoint retourne aussi une **clé navigateur publique** ; ne pas copier sa réponse complète dans un ticket ou une conversation.

Recharger le frontend, puis vérifier une carte, une recherche d'adresse, la sélection d'une adresse et le calcul d'un trajet. En mode Geoapify, vérifier également le chargement des tuiles ; en mode Google, vérifier les suggestions Places. Si l'endpoint de configuration affiche encore l'ancien fournisseur, c'est généralement l'ancien processus backend qui tourne toujours ou une variable d'environnement de l'hébergement qui prime sur le fichier local. Un simple rechargement du frontend ne recharge pas le `.env` du backend.

Les tests unitaires et les builds ne prouvent pas à eux seuls que les clés, leurs restrictions, la facturation et les API du fournisseur fonctionnent en production. Faire un essai réel après chaque changement de clé ou de restriction.

## Différences fonctionnelles et dépannage

Le suivi en direct ne dépend pas du fournisseur de tuiles : le navigateur du voyageur lit le GPS et publie au plus une nouvelle mesure par seconde via WebSocket ; le backend la diffuse aux participants autorisés de la réservation. En mode Geoapify, Leaflet anime le marqueur pendant au plus 650 ms vers la **dernière mesure reçue**. Si les deux mesures sont proches de l'itinéraire sélectionné, le marqueur suit ce tronçon ; sinon il rejoint directement la mesure. L'animation ne prédit pas une position future et s'arrête immédiatement à l'arrivée. Un saut supérieur à 250 m, une mesure trop espacée ou l'absence de timestamp n'est pas interpolé.

L'[API Map Matching de Geoapify](https://apidocs.geoapify.com/docs/map-matching/) traite une série de points GPS pour la rapprocher du réseau routier. Elle n'est pas appelée à chaque nouvelle mesure : cela ajouterait un aller-retour réseau, un coût API et potentiellement du retard au marqueur. Le suivi nécessite toujours une autorisation GPS, une page active et un réseau disponible. Pour vérifier la fluidité réelle, essayer un trajet avec deux téléphones et comparer l'heure de la mesure GPS à son affichage sur le téléphone observateur.

- Google fournit les fonctions de caméra et de vue satellite utilisées par le suivi actuel. Geoapify utilise une carte Leaflet orientée nord ; le cap du voyageur est affiché sur son marqueur, et la commande satellite n'est pas proposée.
- Le trafic Geoapify est estimé (`approximated`), alors que l'intégration Google demande `TRAFFIC_AWARE`. Quand des alternatives sont demandées, le backend essaie `balanced`, `short` et `less_maneuvers`, puis retire les itinéraires identiques : il peut ne rester qu'un seul trajet. Ces requêtes supplémentaires consomment des crédits Geoapify.
- Une erreur de tuiles Geoapify après activation peut venir d'une clé navigateur incorrecte ou d'une restriction de referrer qui n'autorise pas le domaine affiché. Les erreurs de géocodage ou d'itinéraire concernent la clé serveur, son quota ou l'accès à l'API.
- `BillingNotEnabledMapError` après retour à Google indique un problème de facturation du projet Google, pas un problème de `MAP_PROVIDER`.

Références : [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/), [Geoapify API keys](https://myprojects.geoapify.com/help/api-keys/) et [Google Maps API errors](https://developers.google.com/maps/documentation/javascript/error-messages).
