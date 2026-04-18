import axios from 'axios';
import { getAccessToken, clearTokenCache } from './auth.js';

const BASE_URL = 'https://fsm.zoho.com/fsm/v1';
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(error) {
  if (!error.response) return true;
  const status = error.response.status;
  return status >= 500 || status === 429;
}

export async function zohoRequest({ method, path, params, data }) {
  let lastError;
  let forcedRefresh = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const token = await getAccessToken();
      const response = await axios({
        method,
        url: `${BASE_URL}${path}`,
        params,
        data,
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      return response.data;
    } catch (error) {
      lastError = error;

      if (error.response?.status === 401 && !forcedRefresh) {
        forcedRefresh = true;
        clearTokenCache();
        continue;
      }

      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
