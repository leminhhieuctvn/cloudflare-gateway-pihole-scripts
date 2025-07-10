import { getZeroTrustLists, upsertZeroTrustRule } from "./lib/api.js";
import { BLOCK_BASED_ON_SNI, getAccountConfigs } from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

const accountConfigs = getAccountConfigs();

(async () => {
  if (accountConfigs.length === 1) {
    // Single account mode (backward compatibility)
    const { result: lists } = await getZeroTrustLists();

    // Create a Wirefilter expression to match DNS queries against all the lists
    const wirefilterDNSExpression = lists.reduce((previous, current) => {
      return `${previous} any(dns.domains[*] in \$${current.id}) or `;
    }, "");

    console.log("Creating DNS rule...");
    // .slice removes the trailing ' or '
    await upsertZeroTrustRule(wirefilterDNSExpression.slice(0, -4), "CGPS Filter Lists", ["dns"]);

    // Optionally create a rule that matches the SNI.
    // This only works for users who proxy their traffic through Cloudflare.
    if (BLOCK_BASED_ON_SNI) {
      const wirefilterSNIExpression = lists.reduce((previous, current) => {
        return `${previous} any(net.sni.domains[*] in \$${current.id}) or `;
      }, "");

      console.log("Creating SNI rule...");
      // .slice removes the trailing ' or '
      await upsertZeroTrustRule(wirefilterSNIExpression.slice(0, -4), "CGPS Filter Lists - SNI Based Filtering", ["l4"]);
    }

    // Send a notification to the webhook
    await notifyWebhook("CF Gateway Rule Create script finished running");
  } else {
    // Multi-account mode
    console.log(`Creating rules across ${accountConfigs.length} accounts...`);
    
    for (const accountConfig of accountConfigs) {
      console.log(`Creating rules for Account ${accountConfig.accountNumber}...`);
      
      const { result: lists } = await getZeroTrustLists(accountConfig);
      
      if (!lists || lists.length === 0) {
        console.log(`No lists found for Account ${accountConfig.accountNumber}, skipping rule creation.`);
        continue;
      }

      // Create a Wirefilter expression to match DNS queries against all the lists for this account
      const wirefilterDNSExpression = lists.reduce((previous, current) => {
        return `${previous} any(dns.domains[*] in \$${current.id}) or `;
      }, "");

      console.log(`Creating DNS rule for Account ${accountConfig.accountNumber}...`);
      // .slice removes the trailing ' or '
      await upsertZeroTrustRule(wirefilterDNSExpression.slice(0, -4), "CGPS Filter Lists", ["dns"], accountConfig);

      // Optionally create a rule that matches the SNI.
      // This only works for users who proxy their traffic through Cloudflare.
      if (BLOCK_BASED_ON_SNI) {
        const wirefilterSNIExpression = lists.reduce((previous, current) => {
          return `${previous} any(net.sni.domains[*] in \$${current.id}) or `;
        }, "");

        console.log(`Creating SNI rule for Account ${accountConfig.accountNumber}...`);
        // .slice removes the trailing ' or '
        await upsertZeroTrustRule(wirefilterSNIExpression.slice(0, -4), "CGPS Filter Lists - SNI Based Filtering", ["l4"], accountConfig);
      }
    }
    
    // Send a notification to the webhook
    await notifyWebhook(`CF Gateway Rule Create script finished running across ${accountConfigs.length} accounts`);
  }
})();
