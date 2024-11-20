import process from "node:process";
export const setupVerbose = (args: string[] = process.argv.slice(2)): void => {
  if (false === args.includes("--verbose")) {
    console.debug = () => {};
  }
};
