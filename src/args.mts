import os from "node:os";
import process from "node:process";
import { parseArgs } from "@std/cli/parse-args";
export const getCliArgs = () => process.argv.slice(2);

export const getDefaultHost = (
  config: {
    defaultHost?: string;
    cliArgs?: {
      host?: string;
      h?: string;
    };
  } = {},
) => {
  const {
    defaultHost = os.hostname(),
    cliArgs = parseArgs(getCliArgs(), {
      string: ["host"],
      alias: {
        host: "h",
      },
    }),
  } = config;
  let hostname = String(
    cliArgs.host || cliArgs.h || process.env.DWEB_CLOUD_HOST || defaultHost,
  );
  hostname = hostname.toLowerCase();
  if (false === hostname.endsWith(".local")) {
    hostname += ".local";
  }
  return hostname;
};

export const getDefaultPort = (
  config: {
    defaultPort?: number;
    cliArgs?: {
      port?: string | number;
      p?: string | number;
    };
  } = {},
) => {
  const {
    defaultPort = 18080,
    cliArgs = parseArgs(getCliArgs(), {
      string: ["port"],
      alias: {
        port: "p",
      },
    }),
  } = config;
  let port = +(process.env.DWEB_CLOUD_PORT || defaultPort);
  port = +(cliArgs.port || cliArgs.p || port);
  if (Number.isFinite(port) === false) {
    port = defaultPort;
  }
  return port;
};
