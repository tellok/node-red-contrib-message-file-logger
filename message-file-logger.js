"use strict";

const fs = require("node:fs");
const path = require("node:path");
const util = require("node:util");

const PLUGIN_ID = "message-file-logger";
const DEFAULT_MAX_FILES = 72;
const DEFAULT_MAX_FIELD_CHARS = 20000;
const DEFAULT_MAX_CONFIG_CHARS = 1200;
const DEFAULT_REDACT_KEYS = [
  "access_token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "refresh_token",
  "secret",
  "token"
];

function readSettings(RED) {
  const fromGetter =
    RED.settings && typeof RED.settings.get === "function"
      ? RED.settings.get(PLUGIN_ID) || RED.settings.get("messageFileLogger")
      : undefined;
  const fromObject =
    (RED.settings && (RED.settings[PLUGIN_ID] || RED.settings.messageFileLogger)) || {};
  const config = fromGetter || fromObject || {};
  const userDir = RED.settings && RED.settings.userDir ? RED.settings.userDir : process.cwd();

  return {
    enabled: config.enabled !== false && process.env.NR_MESSAGE_LOGGER_ENABLED !== "false",
    directory:
      process.env.NR_MESSAGE_LOGGER_DIR ||
      config.directory ||
      path.join(userDir, "message-logs"),
    filenamePrefix:
      process.env.NR_MESSAGE_LOGGER_PREFIX || config.filenamePrefix || "node-red-messages",
    maxFiles: positiveInt(process.env.NR_MESSAGE_LOGGER_MAX_FILES || config.maxFiles, DEFAULT_MAX_FILES),
    maxFieldChars: positiveInt(
      process.env.NR_MESSAGE_LOGGER_MAX_FIELD_CHARS || config.maxFieldChars,
      DEFAULT_MAX_FIELD_CHARS
    ),
    maxConfigChars: positiveInt(
      process.env.NR_MESSAGE_LOGGER_MAX_CONFIG_CHARS || config.maxConfigChars,
      DEFAULT_MAX_CONFIG_CHARS
    ),
    redactKeys: Array.isArray(config.redactKeys) ? config.redactKeys : DEFAULT_REDACT_KEYS,
    includeFullMessage: config.includeFullMessage !== false,
    includeNodeConfig: config.includeNodeConfig !== false,
    includeCompleteEvents: config.includeCompleteEvents !== false,
    includeStatusEvents: config.includeStatusEvents !== false,
    flowsFile:
      process.env.NR_MESSAGE_LOGGER_FLOWS_FILE ||
      config.flowsFile ||
      path.join(userDir, "flows.json"),
    flowRefreshMs: positiveInt(process.env.NR_MESSAGE_LOGGER_FLOW_REFRESH_MS || config.flowRefreshMs, 30000)
  };
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function hourStamp(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "-" + pad(date.getHours());
}

function isoNow() {
  return new Date().toISOString();
}

function nodeInfo(ref, flowIndex, config) {
  const node = ref && ref.node ? ref.node : {};
  const id = ref && ref.id ? ref.id : node.id;
  const runtimeFlow = node.z;
  const indexed = flowIndex ? flowIndex.node(id) : undefined;
  const flow = runtimeFlow || (indexed && indexed.flow);
  const info = {
    id: ref && ref.id ? ref.id : node.id,
    type: node.type || (indexed && indexed.type),
    name: node.name || (indexed && indexed.name),
    flow,
    flowLabel: flowIndex ? flowIndex.flowLabel(flow) : undefined
  };
  if (config.includeNodeConfig && indexed && indexed.config) {
    info.config = indexed.config;
  }
  return info;
}

function isRedactedKey(key, redactKeys) {
  const lower = String(key).toLowerCase();
  return redactKeys.some((candidate) => lower === String(candidate).toLowerCase());
}

function summarizeValue(value, config, seen) {
  if (value === undefined) {
    return "[undefined]";
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (typeof value === "string") {
    return value.length > config.maxFieldChars
      ? `${value.slice(0, config.maxFieldChars)}...[truncated ${value.length - config.maxFieldChars} chars]`
      : value;
  }
  if (Buffer.isBuffer(value)) {
    return {
      type: "Buffer",
      bytes: value.length,
      preview: value.toString("base64", 0, Math.min(value.length, 256))
    };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }
  if (typeof value !== "object") {
    return util.inspect(value, { depth: 1, breakLength: Infinity });
  }
  if (seen.has(value)) {
    return "[circular]";
  }

  seen.add(value);
  if (Array.isArray(value)) {
    const mapped = value.map((item) => summarizeValue(item, config, seen));
    seen.delete(value);
    return mapped;
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = isRedactedKey(key, config.redactKeys)
      ? "[redacted]"
      : summarizeValue(item, config, seen);
  }
  seen.delete(value);
  return output;
}

function safeMessage(msg, config) {
  if (!config.includeFullMessage) {
    return {
      _msgid: msg && msg._msgid,
      topic: msg && msg.topic,
      payload: summarizeValue(msg && msg.payload, config, new WeakSet())
    };
  }
  return summarizeValue(msg, config, new WeakSet());
}

function truncateText(value, limit) {
  if (typeof value !== "string") {
    return value;
  }
  return value.length > limit ? `${value.slice(0, limit)}...[truncated ${value.length - limit} chars]` : value;
}

function safeError(error, config) {
  if (!error) {
    return undefined;
  }
  if (typeof error === "string") {
    return truncateText(error, config.maxFieldChars);
  }
  return {
    name: error.name,
    message: truncateText(error.message || String(error), config.maxFieldChars),
    code: error.code,
    stack: truncateText(error.stack, config.maxFieldChars)
  };
}

function summarizeNodeConfig(node, config) {
  const summary = {};
  const skip = new Set([
    "id",
    "type",
    "z",
    "g",
    "x",
    "y",
    "wires",
    "_users",
    "credentials"
  ]);
  const preferred = [
    "name",
    "label",
    "topic",
    "url",
    "method",
    "ret",
    "domain",
    "service",
    "action",
    "entityId",
    "entity_id",
    "server",
    "version",
    "outputs",
    "rules",
    "property",
    "propertyType",
    "targetType",
    "halt_if",
    "halt_if_type",
    "for",
    "forType",
    "forUnits"
  ];

  for (const key of preferred) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      summary[key] = summarizeValue(node[key], config, new WeakSet());
    }
  }

  if (typeof node.func === "string") {
    const lines = node.func.split(/\r?\n/);
    summary.funcLines = lines.length;
    summary.funcPreview = truncateText(lines.slice(0, 8).join("\n"), config.maxConfigChars);
  }
  if (typeof node.template === "string") {
    summary.templateLines = node.template.split(/\r?\n/).length;
    summary.templatePreview = truncateText(node.template, config.maxConfigChars);
  }

  for (const [key, value] of Object.entries(node)) {
    if (skip.has(key) || preferred.includes(key) || key === "func" || key === "template") {
      continue;
    }
    if (isRedactedKey(key, config.redactKeys)) {
      summary[key] = "[redacted]";
    }
  }
  return Object.keys(summary).length ? summary : undefined;
}

class FlowIndex {
  constructor(RED, config) {
    this.RED = RED;
    this.config = config;
    this.nodes = new Map();
    this.flows = new Map();
    this.lastMtimeMs = 0;
    this.refreshTimer = null;
  }

  start() {
    this.load(true);
    this.refreshTimer = setInterval(() => this.load(false), this.config.flowRefreshMs);
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  flowLabel(id) {
    return id ? this.flows.get(id) : undefined;
  }

  node(id) {
    return id ? this.nodes.get(id) : undefined;
  }

  load(force) {
    fs.stat(this.config.flowsFile, (statError, stat) => {
      if (statError) {
        if (force || statError.code !== "ENOENT") {
          this.RED.log.warn(`[${PLUGIN_ID}] failed to stat flows file ${this.config.flowsFile}: ${statError.message}`);
        }
        return;
      }
      if (!force && stat.mtimeMs === this.lastMtimeMs) {
        return;
      }
      fs.readFile(this.config.flowsFile, "utf8", (readError, text) => {
        if (readError) {
          this.RED.log.warn(`[${PLUGIN_ID}] failed to read flows file ${this.config.flowsFile}: ${readError.message}`);
          return;
        }
        try {
          const parsed = JSON.parse(text);
          const entries = Array.isArray(parsed) ? parsed : parsed.flows;
          if (!Array.isArray(entries)) {
            throw new Error("flows file did not contain an array");
          }
          const flows = new Map();
          const nodes = new Map();
          for (const entry of entries) {
            if (entry.type === "tab") {
              flows.set(entry.id, entry.label || entry.name);
            }
          }
          for (const entry of entries) {
            if (!entry.id || entry.type === "tab") {
              continue;
            }
            nodes.set(entry.id, {
              id: entry.id,
              type: entry.type,
              name: entry.name,
              flow: entry.z,
              config: summarizeNodeConfig(entry, this.config)
            });
          }
          this.flows = flows;
          this.nodes = nodes;
          this.lastMtimeMs = stat.mtimeMs;
          this.RED.log.info(`[${PLUGIN_ID}] indexed ${nodes.size} nodes across ${flows.size} flows`);
        } catch (parseError) {
          this.RED.log.warn(`[${PLUGIN_ID}] failed to parse flows file ${this.config.flowsFile}: ${parseError.message}`);
        }
      });
    });
  }
}

class HourlyFileWriter {
  constructor(RED, config) {
    this.RED = RED;
    this.config = config;
    this.currentHour = "";
    this.currentFile = "";
    this.queue = [];
    this.flushing = false;
    this.retentionTimer = null;
  }

  start() {
    fs.mkdirSync(this.config.directory, { recursive: true });
    this.cleanupOldFiles();
    this.retentionTimer = setInterval(() => this.cleanupOldFiles(), 15 * 60 * 1000);
    if (this.retentionTimer.unref) {
      this.retentionTimer.unref();
    }
  }

  stop() {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
  }

  append(record) {
    const line = `${JSON.stringify(record)}\n`;
    this.queue.push(line);
    if (!this.flushing) {
      this.flushing = true;
      setImmediate(() => this.flush());
    }
  }

  flush() {
    const batch = this.queue.splice(0, this.queue.length).join("");
    if (!batch) {
      this.flushing = false;
      return;
    }

    const file = this.fileFor(new Date());
    fs.appendFile(file, batch, (error) => {
      if (error) {
        this.RED.log.warn(`[${PLUGIN_ID}] failed to write ${file}: ${error.message}`);
      }
      if (this.queue.length > 0) {
        setImmediate(() => this.flush());
      } else {
        this.flushing = false;
      }
    });
  }

  fileFor(date) {
    const stamp = hourStamp(date);
    if (stamp !== this.currentHour) {
      this.currentHour = stamp;
      this.currentFile = path.join(this.config.directory, `${this.config.filenamePrefix}-${stamp}.log`);
      this.cleanupOldFiles();
    }
    return this.currentFile;
  }

  cleanupOldFiles() {
    fs.readdir(this.config.directory, (error, entries) => {
      if (error) {
        if (error.code !== "ENOENT") {
          this.RED.log.warn(`[${PLUGIN_ID}] failed to list log directory: ${error.message}`);
        }
        return;
      }

      const prefix = `${this.config.filenamePrefix}-`;
      const files = entries
        .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".log"))
        .sort()
        .map((entry) => path.join(this.config.directory, entry));

      const remove = files.slice(0, Math.max(0, files.length - this.config.maxFiles));
      for (const file of remove) {
        fs.unlink(file, (unlinkError) => {
          if (unlinkError && unlinkError.code !== "ENOENT") {
            this.RED.log.warn(`[${PLUGIN_ID}] failed to remove old log ${file}: ${unlinkError.message}`);
          }
        });
      }
    });
  }
}

function registerHook(RED, name, handler) {
  const hookId = `${name}.${PLUGIN_ID}`;
  RED.hooks.add(hookId, handler);
  return hookId;
}

module.exports = function registerMessageFileLogger(RED) {
  let activeWriter = null;
  let activeFlowIndex = null;
  let activeHooks = [];
  let activeEventHandlers = [];

  const pluginDefinition = {
    type: PLUGIN_ID,
    onadd: function onadd() {
      const config = readSettings(RED);
      if (!config.enabled) {
        RED.log.info(`[${PLUGIN_ID}] disabled`);
        return;
      }
      if (!RED.hooks || typeof RED.hooks.add !== "function") {
        RED.log.warn(`[${PLUGIN_ID}] RED.hooks API is unavailable`);
        return;
      }

      const writer = new HourlyFileWriter(RED, config);
      const flowIndex = new FlowIndex(RED, config);
      writer.start();
      flowIndex.start();
      activeWriter = writer;
      activeFlowIndex = flowIndex;

      const hooks = [
        registerHook(RED, "onReceive", (receiveEvent) => {
          writer.append({
            ts: isoNow(),
            event: "input",
            node: nodeInfo(receiveEvent.destination, flowIndex, config),
            msgid: receiveEvent.msg && receiveEvent.msg._msgid,
            message: safeMessage(receiveEvent.msg, config)
          });
        }),
        registerHook(RED, "onSend", (sendEvents) => {
          for (const sendEvent of sendEvents) {
            writer.append({
              ts: isoNow(),
              event: "output",
              node: nodeInfo(sendEvent.source, flowIndex, config),
              destination: {
                id: sendEvent.destination && sendEvent.destination.id,
                node: nodeInfo(sendEvent.destination, flowIndex, config)
              },
              port: sendEvent.source && sendEvent.source.port,
              msgid: sendEvent.msg && sendEvent.msg._msgid,
              message: safeMessage(sendEvent.msg, config)
            });
          }
        }),
        registerHook(RED, "onComplete", (completeEvent) => {
          if (!config.includeCompleteEvents) {
            return;
          }
          writer.append({
            ts: isoNow(),
            event: completeEvent.error ? "error" : "complete",
            node: nodeInfo(completeEvent.node, flowIndex, config),
            msgid: completeEvent.msg && completeEvent.msg._msgid,
            error: safeError(completeEvent.error, config),
            message: safeMessage(completeEvent.msg, config)
          });
        })
      ];
      activeHooks = hooks;

      if (RED.events && typeof RED.events.on === "function") {
        const runtimeHandler = (event) => {
          if (event && event.id === "runtime-state" && event.payload && event.payload.state === "stop") {
            writer.stop();
          }
        };
        RED.events.on("runtime-event", runtimeHandler);
        activeEventHandlers.push(["runtime-event", runtimeHandler]);

        if (config.includeStatusEvents) {
          const statusHandler = (statusEvent) => {
            writer.append({
              ts: isoNow(),
              event: "status",
              node: nodeInfo({ id: statusEvent && statusEvent.id }, flowIndex, config),
              status: summarizeValue(statusEvent && statusEvent.status, config, new WeakSet())
            });
          };
          RED.events.on("node-status", statusHandler);
          activeEventHandlers.push(["node-status", statusHandler]);
        }
      }

      RED.log.info(
        `[${PLUGIN_ID}] logging node input/output/complete/status events to ${config.directory}; retaining ${config.maxFiles} hourly files`
      );
    },
    onremove: function onremove() {
      if (activeWriter) {
        activeWriter.stop();
        activeWriter = null;
      }
      if (activeFlowIndex) {
        activeFlowIndex.stop();
        activeFlowIndex = null;
      }
      for (const hookId of activeHooks) {
        if (RED.hooks && typeof RED.hooks.remove === "function") {
          RED.hooks.remove(hookId);
        }
      }
      activeHooks = [];
      for (const [eventName, handler] of activeEventHandlers) {
        if (RED.events && typeof RED.events.removeListener === "function") {
          RED.events.removeListener(eventName, handler);
        }
      }
      activeEventHandlers = [];
    }
  };

  RED.plugins.registerPlugin(PLUGIN_ID, pluginDefinition);
};
