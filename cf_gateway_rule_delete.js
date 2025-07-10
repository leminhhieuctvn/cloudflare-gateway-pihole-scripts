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
    const cgpsRules = rules.filter(({ name }) => name.startsWith("CGPS Filter Lists"));

    if (!cgpsRules.length) {
      console.warn(
        "No rule(s) with matching name found - this is not an issue if you haven't run the create script yet. Exiting."
      );
      return;
    }

    for (const cgpsRule of cgpsRules) {
      console.log(`Deleting rule ${cgpsRule.name}...`);
      await deleteZeroTrustRule(cgpsRule.id);
    }
    
    // Send a notification to the webhook
    await notifyWebhook("CF Gateway Rule Delete script finished running");
  } else {
    // Multi-account mode
    console.log(`Deleting rules across ${accountConfigs.length} accounts...`);
    
    await deleteZeroTrustRulesForAllAccounts(accountConfigs);
    
    // Send a notification to the webhook
    await notifyWebhook(`CF Gateway Rule Delete script finished running across ${accountConfigs.length} accounts`);
  }
})();
