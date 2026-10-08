// Structured JSON logging (org standard): one JSON object per line with the required fields,
// a CONSTANT message, snake_case field names, and never any PII (no names, emails, IPs, tokens).
type Level = "INFO" | "WARN" | "ERROR";
type Fields = Record<string, string | number | boolean | null>;

export function log(level: Level, logger: string, message: string, requestId: string, fields: Fields = {}) {
  const line = JSON.stringify({
    "@timestamp": new Date().toISOString(),
    level,
    message,
    service: "hackum-web",
    env: process.env.APP_ENV ?? process.env.NODE_ENV ?? "dev",
    request_id: requestId,
    logger,
    ...fields,
  });
  if (level === "ERROR") console.error(line);
  else console.log(line);
}
