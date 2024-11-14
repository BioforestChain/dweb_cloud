import process from "node:process";
export const setupVerbose = (args = process.argv.slice(2)) => {
  if (false === args.includes("--verbose")) {
    console.debug = () => {};
  }
};
