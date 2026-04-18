import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_REGION } = process.env;

if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_REGION) {
  throw new Error('Missing required Zoho env vars: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_REGION');
}

const TOKEN_URL = `https://accounts.zoho.${ZOHO_REGION}/oauth/v2/token`;
const EXPIRY_BUFFER_MS = 60 * 1000;

let cachedToken = null;
let expiresAt = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
    return cachedToken;
  }

  const response = await axios.post(TOKEN_URL, null, {
    params: {
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });

  const { access_token, expires_in } = response.data;
  if (!access_token) {
    throw new Error(`Zoho token refresh failed: ${response.data?.error || 'unknown error'}`);
  }

  cachedToken = access_token;
  expiresAt = Date.now() + expires_in * 1000;
  return cachedToken;
}

export function clearTokenCache() {
  cachedToken = null;
  expiresAt = 0;
}
