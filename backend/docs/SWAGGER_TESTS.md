# Guide Swagger Local Et Production

## 1. Objectif
Swagger est la reference principale pour tester manuellement les endpoints HTTP du backend Jokko. Il expose les routes, les DTO, les exemples de reponse et l'enveloppe standard utilisee par l'API :

```json
{
  "success": true,
  "message": "Operation effectuee avec succes.",
  "data": {},
  "meta": {}
}
```

## 2. URLs De Test

| Environnement | Swagger | API HTTP |
| --- | --- | --- |
| Local | `http://localhost:3000/api/docs` | `http://localhost:3000/api/v1` |
| Production Render | `https://jokko-dimbali.onrender.com/api/docs` | `https://jokko-dimbali.onrender.com/api/v1` |

Dans l'interface Swagger, le selecteur `Servers` permet de choisir entre le serveur local et le serveur Render. Pour tester la production, selectionner `Production Render - Jokko Dimbali`, puis executer les routes avec `Try it out`.

## 3. Verification Rapide Avant Les Tests Metier

Toujours commencer par :

```bash
curl https://jokko-dimbali.onrender.com/api/v1/sante
```

La reponse doit etre en HTTP 200. Si `data.baseDeDonnees` vaut `deconnectee`, le backend repond mais la base PostgreSQL de production doit etre corrigee avant de valider les flux metier.

## 4. Authentification Dans Swagger

Les routes publiques comme `GET /categories`, `GET /professionals` et `GET /search/professionals` peuvent etre testees directement.

Les routes protegees comme `GET /auth/me`, `GET /favorites`, `GET /notifications` ou les routes admin retournent `401 Unauthorized` sans session ou jeton valide. Pour les tester :

1. Se connecter via `POST /auth/login` ou `POST /auth/otp/verify`.
2. Recuperer le jeton d'acces si le client de test l'expose.
3. Cliquer sur `Authorize`.
4. Renseigner `Bearer <accessToken>`.
5. Rejouer la route protegee.

Le backend utilise aussi des cookies HTTP-only pour l'application web. Dans Swagger, le mode le plus fiable reste le bearer token lorsque l'on teste manuellement des routes protegees.

## 5. Endpoints Publics A Tester En Premier Sur Render

```text
GET /api/v1/sante
GET /api/v1/categories?page=1&limit=5
GET /api/v1/professionals?page=1&limit=3
GET /api/v1/search/professionals?query=medecin&page=1&limit=3
```

Resultat attendu :

- HTTP 200 sur les routes publiques.
- Enveloppe JSON coherente avec `success`, `data`, `message` et parfois `meta`.
- Pagination presente sur les listes.

## 6. Endpoints Proteges A Tester Ensuite

```text
GET /api/v1/favorites
GET /api/v1/auth/me
GET /api/v1/notifications
GET /api/v1/reservations/my
```

Sans authentification, `401 Unauthorized` est attendu et confirme que la protection est active. Avec un utilisateur connecte, ces routes doivent retourner les donnees du compte courant.

## 7. Notes CORS Production

En production Render, `CORS_ORIGINS=*` autorise les origines web en reflet dynamique avec `credentials: true`. C'est volontairement different d'un header brut `Access-Control-Allow-Origin: *`, qui est incompatible avec les cookies cross-site.

Pour le frontend Vercel actuel, l'origine principale est :

```text
https://jokko-dimbali.vercel.app
```

## 8. Preuve De Verification Render

Derniere verification manuelle effectuee le 8 mai 2026 :

- `GET /api/docs` : HTTP 200.
- `GET /api/v1/categories?page=1&limit=5` : HTTP 200 avec pagination.
- `GET /api/v1/professionals?page=1&limit=3` : HTTP 200 avec resultats.
- `GET /api/v1/search/professionals?query=medecin&page=1&limit=3` : HTTP 200 avec resultats.
- `GET /api/v1/favorites` sans token : HTTP 401 attendu.
- `GET /api/v1/sante` : HTTP 200, mais `baseDeDonnees` a repondu `deconnectee` pendant le test. Il faut donc verifier `DATABASE_URL`, l'accessibilite PostgreSQL et les migrations Render avant de declarer la production entierement saine.
