// Every API response uses one of these two shapes.
export function successEnvelope({ data, meta, requestId }) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  body.requestId = requestId;
  return body;
}

export function errorEnvelope({ code, message, details, requestId }) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error, requestId };
}
