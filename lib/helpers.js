import {
  ACCOUNT_EMAIL,
  ACCOUNT_ID,
  API_HOST,
  API_KEY,
  API_TOKEN,
  getAccountConfigs,
} from "./constants.js";
import { fetchRetry } from "./utils.js";

if (!globalThis.fetch) {
  console.warn(
    "\nIMPORTANT: Your Node.js version doesn't have native fetch support and may not be supported in the future. Please update to v18 or later.\n"
  );
  // Advise what to do if running in GitHub Actions
  if (process.env.GITHUB_WORKSPACE)
    console.warn(
      "Since you're running in GitHub Actions, you should update your Actions workflow configuration to use Node v18 or higher."
    );
  // Import node-fetch since there's no native fetch in this environment
  globalThis.fetch = (await import("node-fetch")).default;
}

/**
 * Fires request to the specified URL.
 * @param {string} url The URL to which the request will be fired.
 * @param {RequestInit} options The options to be passed to `fetch`.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise}
 */
const request = async (url, options, accountConfig = null) => {
  const apiToken = accountConfig ? accountConfig.apiToken : API_TOKEN;
  const accountId = accountConfig ? accountConfig.accountId : ACCOUNT_ID;
  
  if (!(apiToken || API_KEY) || !accountId) {
    throw new Error(
      "The following secrets are required: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID"
    );
  }

  const headers = apiToken
    ? {
        Authorization: `Bearer ${apiToken}`,
      }
    : {
        Authorization: `Bearer ${API_KEY}`,
        "X-Auth-Email": ACCOUNT_EMAIL,
        "X-Auth-Key": API_KEY,
      };
  let data;

  try {
    const response = await fetchRetry(url, {
      ...options,
      headers: {
      "Content-Type": "application/json",
        ...options.headers,
        ...headers,
      },
    });

    return await response.json();
  } catch (error) {
    throw new Error(`${(data && 'errors' in data) ? data.errors[0].message : data} - ${error}`);
  }
};

/**
 * Fires request to the Zero Trust gateway.
 * @param {string} path The path which will be appended to the request URL.
 * @param {RequestInit} options The options to be passed to `fetch`.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise}
 */
export const requestGateway = (path, options, accountConfig = null) => {
  const accountId = accountConfig ? accountConfig.accountId : ACCOUNT_ID;
  return request(`${API_HOST}/accounts/${accountId}/gateway${path}`, options, accountConfig);
};

/**
 * Fires request to the Zero Trust gateway for a specific account.
 * @param {string} path The path which will be appended to the request URL.
 * @param {RequestInit} options The options to be passed to `fetch`.
 * @param {Object} accountConfig The account configuration to use.
 * @returns {Promise}
 */
export const requestGatewayForAccount = (path, options, accountConfig) => {
  return request(`${API_HOST}/accounts/${accountConfig.accountId}/gateway${path}`, options, accountConfig);
};

/**
 * Normalizes a domain.
 * @param {string} value The value to be normalized.
 * @param {boolean} isAllowlisting Whether the value is to be allowlisted.
 * @returns {string}
 */
export const normalizeDomain = (value, isAllowlisting) => {
  const init = (isAllowlisting) ? value.replace("@@||", "") : value;
  const normalized = init
    .replace(/(0\.0\.0\.0|127\.0\.0\.1|::1|::)\s+/, "")
    .replace("||", "")
    .replace("^$important", "")
    .replace("*.", "")
    .replace("^", "");

  return normalized;
};
