import { BLOCK_PAGE_ENABLED, DEBUG, LIST_ITEM_SIZE, LIST_ITEM_LIMIT, getAccountConfigs } from "./constants.js";
import { requestGateway, requestGatewayForAccount } from "./helpers.js";

/**
 * Gets Zero Trust lists.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-lists-list-zero-trust-lists
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const getZeroTrustLists = (accountConfig = null) =>
  requestGateway("/lists", {
    method: "GET",
  }, accountConfig);

/**
 * Creates a Zero Trust list.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-lists-create-zero-trust-list
 * @param {string} name The name of the list.
 * @param {Object[]} items The domains in the list.
 * @param {string} items[].value The domain of an entry.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise}
 */
const createZeroTrustList = (name, items, accountConfig = null) =>
  requestGateway(`/lists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: "DOMAIN",
      items,
    }),
  }, accountConfig);

/**
 * Creates Zero Trust lists sequentially.
 * @param {string[]} items The domains.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 */
export const createZeroTrustListsOneByOne = async (items, accountConfig = null) => {
  let totalListNumber = Math.ceil(items.length / LIST_ITEM_SIZE);

  for (let i = 0, listNumber = 1; i < items.length; i += LIST_ITEM_SIZE) {
    const chunk = items
      .slice(i, i + LIST_ITEM_SIZE)
      .map((item) => ({ value: item }));
    const accountSuffix = accountConfig ? ` - Account ${accountConfig.accountNumber}` : '';
    const listName = `CGPS List - Chunk ${listNumber}${accountSuffix}`;

    try {
      await createZeroTrustList(listName, chunk, accountConfig);
      totalListNumber--;
      listNumber++;

      console.log(`Created "${listName}" list - ${totalListNumber} left`);
    } catch (err) {
      console.error(`Could not create "${listName}" - ${err.toString()}`);
      throw err;
    }
  }
};

/**
 * Creates Zero Trust lists for multiple accounts.
 * @param {string[]} items The domains.
 * @param {Object[]} accountConfigs Array of account configurations.
 */
export const createZeroTrustListsForMultipleAccounts = async (items, accountConfigs) => {
  if (accountConfigs.length === 0) {
    throw new Error("No account configurations provided");
  }

  // Each account gets CLOUDFLARE_LIST_ITEM_LIMIT - 1 domains
  const domainsPerAccount = LIST_ITEM_LIMIT - 1;
  const totalDomains = items.length;
  const requiredAccounts = Math.ceil(totalDomains / domainsPerAccount);

  if (accountConfigs.length < requiredAccounts) {
    throw new Error(`Not enough accounts configured. Need ${requiredAccounts} accounts for ${totalDomains} domains (${domainsPerAccount} per account), but only ${accountConfigs.length} accounts are configured.`);
  }

  console.log(`Distributing ${totalDomains} domains across ${accountConfigs.length} accounts (${domainsPerAccount} domains per account)`);

  let startIndex = 0;
  for (let i = 0; i < accountConfigs.length && startIndex < items.length; i++) {
    const accountConfig = accountConfigs[i];
    const domainsForThisAccount = Math.min(domainsPerAccount, items.length - startIndex);
    const accountItems = items.slice(startIndex, startIndex + domainsForThisAccount);
    
    if (accountItems.length > 0) {
      console.log(`Creating lists for Account ${accountConfig.accountNumber} (${accountItems.length} domains, domains ${startIndex + 1}-${startIndex + accountItems.length})`);
      await createZeroTrustListsOneByOne(accountItems, accountConfig);
    }
    
    startIndex += domainsForThisAccount;
  }
};

/**
 * Deletes a Zero Trust list.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-lists-delete-zero-trust-list
 * @param {number} id The ID of the list.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<any>}
 */
const deleteZeroTrustList = (id, accountConfig = null) =>
  requestGateway(`/lists/${id}`, { method: "DELETE" }, accountConfig);

/**
 * Deletes Zero Trust lists sequentially.
 * @param {Object[]} lists The lists to be deleted.
 * @param {number} lists[].id The ID of a list.
 * @param {string} lists[].name The name of a list.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 */
export const deleteZeroTrustListsOneByOne = async (lists, accountConfig = null) => {
  let totalListNumber = lists.length;

  for (const { id, name } of lists) {
    try {
      await deleteZeroTrustList(id, accountConfig);
      totalListNumber--;

      console.log(`Deleted ${name} list - ${totalListNumber} left`);
    } catch (err) {
      console.error(`Could not delete ${name} - ${err.toString()}`);
      throw err;
    }
  }
};

/**
 * Deletes Zero Trust lists for all accounts.
 * @param {Object[]} accountConfigs Array of account configurations.
 */
export const deleteZeroTrustListsForAllAccounts = async (accountConfigs) => {
  for (const accountConfig of accountConfigs) {
    try {
      console.log(`Deleting lists for Account ${accountConfig.accountNumber}`);
      const response = await getZeroTrustLists(accountConfig);
      
      // Check if response and result exist
      if (!response || !response.result) {
        console.log(`No lists found for Account ${accountConfig.accountNumber} (API returned null/empty response)`);
        continue;
      }
      
      const lists = response.result;
      const cgpsLists = lists.filter(list => list.name.includes('CGPS List'));
      
      if (cgpsLists.length > 0) {
        await deleteZeroTrustListsOneByOne(cgpsLists, accountConfig);
      } else {
        console.log(`No CGPS lists found for Account ${accountConfig.accountNumber}`);
      }
    } catch (err) {
      console.error(`Error deleting lists for Account ${accountConfig.accountNumber}: ${err.toString()}`);
      // Don't throw the error, just log it and continue with other accounts
      console.log(`Skipping Account ${accountConfig.accountNumber} due to error`);
    }
  }
};

/**
 * Gets Zero Trust rules.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-gateway-rules-list-zero-trust-gateway-rules
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const getZeroTrustRules = (accountConfig = null) =>
  requestGateway("/rules", { method: "GET" }, accountConfig);

/**
 * Upserts a Zero Trust rule.
 * If a rule with the same name exists, will update it. Otherwise create a new rule.
 * @param {string} wirefilterExpression The expression to be used for the rule.
 * @param {string} name The name of the rule.
 * @param {string[]} filters The filters to be used for the rule. Default is ["dns"]. Possible values are ["dns", "http", "l4", "egress"].
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const upsertZeroTrustRule = async (wirefilterExpression, name = "CGPS Filter Lists", filters = ["dns"], accountConfig = null) => {
  try {
    const response = await getZeroTrustRules(accountConfig);
    
    // Check if response and result exist
    if (!response || !response.result) {
      console.log(`No existing rules found for account, creating new rule "${name}"`);
      return createZeroTrustRule(wirefilterExpression, name, filters, accountConfig);
    }
    
    const existingRules = response.result;
    const existingRule = existingRules.find(rule => rule.name === name);
    
    if (existingRule) {
      if (DEBUG) console.log(`Found "${existingRule.name}" in rules, updating...`);
      return updateZeroTrustRule(existingRule.id, wirefilterExpression, name, filters, accountConfig);
    }
    
    if (DEBUG) console.log(`No existing rule named "${name}", creating...`);
    return createZeroTrustRule(wirefilterExpression, name, filters, accountConfig);
  } catch (err) {
    console.error(`Error upserting rule "${name}": ${err.toString()}`);
    throw err;
  }
}

/**
 * Creates a Zero Trust rule.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-gateway-rules-create-zero-trust-gateway-rule
 * @param {string} wirefilterExpression The expression to be used for the rule.
 * @param {string} name The name of the rule.
 * @param {string[]} filters The filters to be used for the rule. Default is ["dns"]. Possible values are ["dns", "http", "l4", "egress"].
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const createZeroTrustRule = async (wirefilterExpression, name = "CGPS Filter Lists", filters = ["dns"], accountConfig = null) => {
  try {
    await requestGateway("/rules", {
      method: "POST",
      body: JSON.stringify({
        name,
        description:
          "Filter lists created by Cloudflare Gateway Pi-hole Scripts. Avoid editing this rule. Changing the name of this rule will break the script.",
        enabled: true,
        action: "block",
        rule_settings: { "block_page_enabled": BLOCK_PAGE_ENABLED, "block_reason": "Blocked by CGPS, check your filter lists if this was a mistake." },
        filters,
        traffic: wirefilterExpression,
      }),
    }, accountConfig);

    console.log("Created rule successfully");
  } catch (err) {
    console.error(`Error occurred while creating rule - ${err.toString()}`);
    throw err;
  }
};

/**
 * Updates a Zero Trust rule.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-gateway-rules-update-zero-trust-gateway-rule
 * @param {number} id The ID of the rule to be updated. 
 * @param {string} wirefilterExpression The expression to be used for the rule.
 * @param {string} name The name of the rule. 
 * @param {string[]} filters The filters to be used for the rule.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const updateZeroTrustRule = async (id, wirefilterExpression, name = "CGPS Filter Lists", filters = ["dns"], accountConfig = null) => {
  try {
    await requestGateway(`/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        // Name and action are required fields, even if they haven't changed.
        // And enabled must always be set to true, otherwise the rule will be disabled if omitted.
        name,
        description:
          "Filter lists created by Cloudflare Gateway Pi-hole Scripts. Avoid editing this rule. Changing the name of this rule will break the script.",
        action: "block",
        enabled: true,
        rule_settings: { "block_page_enabled": BLOCK_PAGE_ENABLED, "block_reason": "Blocked by CGPS, check your filter lists if this was a mistake." },
        filters,
        traffic: wirefilterExpression,
      }),
    }, accountConfig);

    console.log("Updated existing rule successfully");
  } catch (err) {
    console.error(`Error occurred while updating rule - ${err.toString()}`);
    throw err;
  }
};

/**
 * Deletes a Zero Trust rule.
 *
 * API docs: https://developers.cloudflare.com/api/operations/zero-trust-gateway-rules-delete-zero-trust-gateway-rule
 * @param {number} id The ID of the rule to be deleted.
 * @param {Object} accountConfig Optional account configuration for multi-account support.
 * @returns {Promise<Object>}
 */
export const deleteZeroTrustRule = async (id, accountConfig = null) => {
  try {
    await requestGateway(`/rules/${id}`, {
      method: "DELETE",
    }, accountConfig);

    console.log("Deleted rule successfully");
  } catch (err) {
    console.error(`Error occurred while deleting rule - ${err.toString()}`);
    throw err;
  }
};

/**
 * Deletes Zero Trust rules for all accounts.
 * @param {Object[]} accountConfigs Array of account configurations.
 */
export const deleteZeroTrustRulesForAllAccounts = async (accountConfigs) => {
  for (const accountConfig of accountConfigs) {
    try {
      console.log(`Deleting rules for Account ${accountConfig.accountNumber}`);
      const response = await getZeroTrustRules(accountConfig);
      
      // Check if response and result exist
      if (!response || !response.result) {
        console.log(`No rules found for Account ${accountConfig.accountNumber} (API returned null/empty response)`);
        continue;
      }
      
      const rules = response.result;
      const cgpsRules = rules.filter(rule => rule.name === 'CGPS Filter Lists');
      
      if (cgpsRules.length > 0) {
        for (const rule of cgpsRules) {
          await deleteZeroTrustRule(rule.id, accountConfig);
        }
      } else {
        console.log(`No CGPS rules found for Account ${accountConfig.accountNumber}`);
      }
    } catch (err) {
      console.error(`Error deleting rules for Account ${accountConfig.accountNumber}: ${err.toString()}`);
      // Don't throw the error, just log it and continue with other accounts
      console.log(`Skipping Account ${accountConfig.accountNumber} due to error`);
    }
  }
};
