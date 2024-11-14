import os from "node:os";
import process from "node:process";
export const getDefaultHost = async (
  defaultHost = os.hostname(),
  args = process.argv.slice(2)
) => {
  let hostname = process.env.DWEB_CLOUD_HOST || defaultHost;
  if (args.length > 0) {
    const { parseArgs } = await import("@std/cli/parse-args");
    const cliArgs = parseArgs(process.argv.slice(1));
    hostname = String(cliArgs.host || cliArgs.h || hostname);
  }
  hostname = hostname.toLowerCase();
  if (false === hostname.endsWith(".local")) {
    hostname += ".local";
  }
  return hostname;
};

export const getDefaultPort = async (
  defaultPort = 18080,
  args = process.argv.slice(2)
) => {
  let port = +(process.env.DWEB_CLOUD_PORT || defaultPort);
  if (args.length > 0) {
    const { parseArgs } = await import("@std/cli/parse-args");
    const cliArgs = parseArgs(process.argv.slice(1));
    port = +(cliArgs.port || cliArgs.p || port);
  }

  if (Number.isFinite(port) === false) {
    port = defaultPort;
  }
  return port;
};
