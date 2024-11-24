import type http from "node:http";
export const responseJson: <T extends unknown>(
  res: http.ServerResponse,
  data: T,
  stringify?: (data: T) => string
) => void = (res, data, stringify = JSON.stringify) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(stringify(data));
};
export const responseText = (res: http.ServerResponse, data: string) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(data);
};
