import { import_meta_ponyfill } from "import-meta-ponyfill";
import { setupVerbose } from "./helper/logger.mts";
import { parseArgs } from "@std/cli/parse-args";
import { getCliArgs, getDefaultHost, getDefaultPort } from "./args.mts";
import { createMemoryDnsDb, startGateway } from "./gateway.mts";
import { bfmetaSignUtil } from "@dweb/cloud/helper";

if (import_meta_ponyfill(import.meta).main) {
  setupVerbose();
  const cliArgs = parseArgs(getCliArgs(), {
    string: ["host", "port", "cert", "key"],
    alias: {
      host: "h",
      port: "p",
    },
  });
  const host = getDefaultHost({ cliArgs });
  const port = getDefaultPort({ cliArgs });
  const db = createMemoryDnsDb();
  void startGateway(bfmetaSignUtil, db, {
    ...cliArgs,
    host,
    port,
    sep: "-",
  });
}
