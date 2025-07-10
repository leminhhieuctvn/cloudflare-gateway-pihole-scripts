import { 
  deleteZeroTrustRule, 
  getZeroTrustRules,
  deleteZeroTrustRulesForAllAccounts
} from "./lib/api.js";
import { getAccountConfigs } from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

const accountConfigs = getAccountConfigs();

(async () => {
  if (accountConfigs.length === 1) {
    // Single account mode (backward compatibility)
    const { result: rules } = await getZeroTrustRules();

    if (!rules || !rules.length) {
      console.warn(
        "No rule(s) found - this is not an issue if you haven't run the create script yet. Exiting."
      );
      return;
    }

    console.log(`Found ${rules.length} rules, deleting all...`);
    
    for (const rule of rules) {
      console.log(`Deleting rule ${rule.name}...`);
      await deleteZeroTrustRule(rule.id);
    }
    
    // Send a notification to the webhook
    await notifyWebhook(`CF Gateway Rule Delete script finished running (${rules.length} rules)`);
  } else {
    // Multi-account mode
    console.log(`Deleting rules across ${accountConfigs.length} accounts...`);
    
    await deleteZeroTrustRulesForAllAccounts(accountConfigs);
    
    // Send a notification to the webhook
    await notifyWebhook(`CF Gateway Rule Delete script finished running across ${accountConfigs.length} accounts`);
  }
})();
