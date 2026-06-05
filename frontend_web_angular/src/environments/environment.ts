export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1', // Ajuster selon le backend
  // Web Client ID Google OAuth. Doit aussi etre renseigne cote backend dans GOOGLE_CLIENT_ID.
  googleClientId: '204626001955-i04qgqksc0e31i82tc3b6iqofos8b24f.apps.googleusercontent.com',
  // Cle Google Maps JavaScript API avec Places. Laisser vide pour utiliser seulement la position GPS du navigateur.
  googleMapsApiKey: '',
};
