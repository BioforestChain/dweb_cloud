import type http from "node:http";
export const responseJson = (
  res: http.ServerResponse,
  data: unknown,
  replacer?: (this: any, key: string, value: any) => any,
) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, replacer));
};
export const responseText = (res: http.ServerResponse, data: string) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(data);
};
