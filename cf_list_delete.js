import {
  deleteZeroTrustListsOneByOne,
  deleteZeroTrustListsForAllAccounts,
  getZeroTrustLists,
} from "./lib/api.js";
import { getAccountConfigs } from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

(async () => {
  const accountConfigs = getAccountConfigs();
  
  if (accountConfigs.length === 1) {
    // Single account mode (backward compatibility)
    const { result: lists } = await getZeroTrustLists();

    if (!lists) {
      console.warn(
        "No file lists found - this is not an issue if it's your first time running this script. Exiting."
      );
      return;
    }

    if (!lists.length) {
      console.warn(
        "No lists found - this is not an issue if you haven't created any filter lists before. Exiting."
      );
      return;
    }

    console.log(
      `Got ${lists.length} lists, all will be deleted.`
    );

    console.log(`Deleting ${lists.length} lists...`);

    await deleteZeroTrustListsOneByOne(lists);
    await notifyWebhook(`CF List Delete script finished running (${lists.length} lists)`);
  } else {
    // Multi-account mode
    console.log(`Deleting lists across ${accountConfigs.length} accounts...`);
    
    await deleteZeroTrustListsForAllAccounts(accountConfigs);
    await notifyWebhook(`CF List Delete script finished running across ${accountConfigs.length} accounts`);
  }
})();
