// Base URL for fetching assets (JSON files and images)
// In production, fetch from GitHub repository
// In development, use local assets
export const ASSETS_BASE_URL = import.meta.env.PROD 
  ? 'https://raw.githubusercontent.com/Armagdy/mushafy/master/public/assets'
  : '/assets';
