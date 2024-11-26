import { import_meta_ponyfill } from "import-meta-ponyfill";
import { getDefaultHost } from "./args.mts";
import { startMdnsServer } from "./mdns.mts";

if (import_meta_ponyfill(import.meta).main) {
  const hostname = await getDefaultHost();
  startMdnsServer(hostname);
}
