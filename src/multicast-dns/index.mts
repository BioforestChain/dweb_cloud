import { func_remember } from "@gaubee/util";
import packet, { type Question, type RecordType } from "dns-packet";
import dgram from "node:dgram";
import events from "node:events";
import cluster from "node:cluster";
import os from "node:os";
import type { mDNS } from "./types.mts";
export * from "./types.mts";

const noop = () => {};

export function multicastDNS(opts: mDNS.Options = {}) {
  const that = new events.EventEmitter();
  let port = typeof opts.port === "number" ? opts.port : 5353;
  const type = opts.type || "udp4";
  const ip =
    opts.ip || opts.host || (type === "udp4" ? "224.0.0.251" : undefined);
  const me: mDNS.RemoteInfoOutgoing & { host?: string } = {
    address: ip,
    port: port,
  };
  let memberships: Record<string, boolean> = {};
  let destroyed = false;
  let interval: number | null = null;

  if (type === "udp6" && (!ip || !opts.interface)) {
    throw new Error("For IPv6 multicast you must specify `ip` and `interface`");
  }

  const socket =
    opts.socket ||
    dgram.createSocket({
      type: type,
      reuseAddr: opts.reuseAddr !== false,
    });

  socket.on("error", function (err: Error & { code?: string }) {
    if (err.code === "EACCES" || err.code === "EADDRINUSE")
      that.emit("error", err);
    else that.emit("warning", err);
  });

  socket.on("message", function (message, rinfo) {
    let packet_msg: packet.DecodedPacket;
    try {
      packet_msg = packet.decode(message);
    } catch (err) {
      that.emit("warning", err);
      return;
    }

    that.emit("packet", packet_msg, rinfo);

    if (packet_msg.type === "query") that.emit("query", packet_msg, rinfo);
    if (packet_msg.type === "response")
      that.emit("response", packet_msg, rinfo);
  });

  socket.on("listening", function () {
    if (!port) port = me.port = socket.address().port;
    if (opts.multicast !== false) {
      update();
      interval = setInterval(update, 5000);
      socket.setMulticastTTL(opts.ttl || 255);
      socket.setMulticastLoopback(opts.loopback !== false);
    }
  });

  const bind = func_remember(function (cb) {
    if (!port || opts.bind === false) return cb(null);
    socket.once("error", cb);
    socket.bind(
      {
        port: port,
        address: opts.bind || opts.interface,
        // windows 的 cluster 必须是 exclusive，否则异常
        exclusive: cluster.isWorker && os.platform() === "win32",
      },
      function () {
        socket.removeListener("error", cb);
        cb(null);
      },
    );
  });

  bind(function (err: Error | null) {
    if (err) return that.emit("error", err);
    that.emit("ready");
  });

  const send = function (
    value: mDNS.ResponseOutgoingPacket | mDNS.QueryOutgoingPacket,
    _rinfo?: mDNS.RemoteInfoOutgoing,
    _cb?: mDNS.ResponsedCallback,
  ) {
    if (typeof _rinfo === "function") return send(value, undefined, _rinfo);
    const cb = _cb ?? noop;
    const rinfo = _rinfo ?? me;
    if (!rinfo.host && !rinfo.address) rinfo.address = me.address;

    bind(onbind);

    function onbind(err: Error | null) {
      if (destroyed) return cb(null);
      if (err) return cb(err);
      const message = packet.encode(value);
      socket.send(
        message,
        0,
        message.length,
        rinfo.port,
        rinfo.address || rinfo.host,
        cb,
      );
    }
  };

  const response = function (res, rinfo, cb) {
    if (Array.isArray(res)) res = { answers: res };

    res.type = "response";
    res.flags = (res.flags || 0) | packet.AUTHORITATIVE_ANSWER;
    send(res, rinfo, cb);
  } as mDNS.MulticastDNS["respond"];

  const _query = function (
    q: string | Question[] | mDNS.QueryOutgoingPacket,
    type?: RecordType | mDNS.RemoteInfoOutgoing | mDNS.QueryCallback,
    rinfo?: mDNS.RemoteInfoOutgoing | mDNS.QueryCallback,
    cb?: mDNS.QueryCallback,
  ) {
    if (typeof type === "function")
      return _query(q, undefined, undefined, type);
    if (typeof type === "object" && type && type.port)
      return _query(q, undefined, type, rinfo as mDNS.QueryCallback);
    if (typeof rinfo === "function") return _query(q, type, undefined, rinfo);
    if (!cb) cb = noop;

    if (typeof q === "string")
      q = [{ name: q, type: (type as RecordType) || "ANY" }];
    if (Array.isArray(q)) q = { type: "query", questions: q };

    q.type = "query";
    send(q, rinfo, cb);
  };
  const query = _query as mDNS.MulticastDNS["query"];

  const destroy = function (cb?: () => void) {
    if (!cb) cb = noop;
    if (destroyed) return queueMicrotask(cb);
    destroyed = true;
    interval && clearInterval(interval);

    // Need to drop memberships by hand and ignore errors.
    // socket.close() does not cope with errors.
    for (const iface in memberships) {
      try {
        ip && socket.dropMembership(ip, iface);
      } catch (_e) {
        // eat it
      }
    }
    memberships = {};
    socket.close(cb);
  };

  const update = function () {
    const ifaces = opts.interface
      ? ([] as string[]).concat(opts.interface)
      : allInterfaces();
    let updated = false;

    for (let i = 0; i < ifaces.length; i++) {
      const addr = ifaces[i]!;
      if (memberships[addr]) continue;

      try {
        ip && socket.addMembership(ip, addr);
        memberships[addr] = true;
        updated = true;
      } catch (err) {
        that.emit("warning", err);
      }
    }

    if (updated) {
      if (socket.setMulticastInterface) {
        try {
          socket.setMulticastInterface(opts.interface || defaultInterface());
        } catch (err) {
          that.emit("warning", err);
        }
      }
      that.emit("networkInterface");
    }
  };

  return Object.assign(that, {
    send: send,
    response: response,
    respond: response,
    query: query,
    destroy: destroy,
    update: update,
  });
}

function defaultInterface() {
  const networks = os.networkInterfaces();
  const names = Object.keys(networks);

  for (let i = 0; i < names.length; i++) {
    const net = networks[names[i]]!;
    for (let j = 0; j < net.length; j++) {
      const iface = net[j];
      if (isIPv4(iface.family) && !iface.internal) {
        if (os.platform() === "darwin" && names[i] === "en0")
          return iface.address;
        return "0.0.0.0";
      }
    }
  }

  return "127.0.0.1";
}

function allInterfaces() {
  const networks = os.networkInterfaces();
  const names = Object.keys(networks);
  const res = [];

  for (let i = 0; i < names.length; i++) {
    const net = networks[names[i]]!;
    for (let j = 0; j < net.length; j++) {
      const iface = net[j];
      if (isIPv4(iface.family)) {
        res.push(iface.address);
        // could only addMembership once per interface (https://nodejs.org/api/dgram.html#dgram_socket_addmembership_multicastaddress_multicastinterface)
        break;
      }
    }
  }

  return res;
}

function isIPv4(family: unknown) {
  // for backwards compat
  return family === 4 || family === "IPv4";
}
