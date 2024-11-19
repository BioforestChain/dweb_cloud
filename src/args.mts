import os from "node:os";
import process from "node:process";
import {
  Aliases,
  Args,
  BooleanType,
  Collectable,
  Negatable,
  parseArgs,
  ParseOptions,
  StringType,
  Values,
} from "@std/cli/parse-args";
export const parseCliArgs = <
  TArgs extends Values<
    TBooleans,
    TStrings,
    TCollectable,
    TNegatable,
    TDefaults,
    TAliases
  >,
  TDoubleDash extends boolean | undefined = undefined,
  TBooleans extends BooleanType = undefined,
  TStrings extends StringType = undefined,
  TCollectable extends Collectable = undefined,
  TNegatable extends Negatable = undefined,
  TDefaults extends Record<string, unknown> | undefined = undefined,
  TAliases extends Aliases<TAliasArgNames, TAliasNames> | undefined = undefined,
  TAliasArgNames extends string = string,
  TAliasNames extends string = string
>(
  options: ParseOptions<
    TBooleans,
    TStrings,
    TCollectable,
    TNegatable,
    TDefaults,
    TAliases,
    TDoubleDash
  >,
  args = process.argv.slice(2)
) => {
  const cliArgs = parseArgs<
    TArgs,
    TDoubleDash,
    TBooleans,
    TStrings,
    TCollectable,
    TNegatable,
    TDefaults,
    TAliases,
    TAliasArgNames,
    TAliasNames
  >(args, options);
  return cliArgs;
};

export const getDefaultHost = async (
  defaultHost = os.hostname(),
  cliArgs: {
    host?: string;
    h?: string;
  } = parseCliArgs({
    string: ["host"],
    alias: {
      host: "h",
    },
  })
) => {
  let hostname = String(
    cliArgs.host || cliArgs.h || process.env.DWEB_CLOUD_HOST || defaultHost
  );
  hostname = hostname.toLowerCase();
  if (false === hostname.endsWith(".local")) {
    hostname += ".local";
  }
  return hostname;
};

export const getDefaultPort = async (
  defaultPort = 18080,
  cliArgs: {
    port?: string | number;
    p?: string | number;
  } = parseCliArgs({
    string: ["port"],
    alias: {
      port: "p",
    },
  })
) => {
  let port = +(process.env.DWEB_CLOUD_PORT || defaultPort);
  port = +(cliArgs.port || cliArgs.p || port);
  if (Number.isFinite(port) === false) {
    port = defaultPort;
  }
  return port;
};
