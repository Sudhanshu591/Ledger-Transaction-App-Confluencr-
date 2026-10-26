import { AppError } from '../errors.js';

// Every error leaves the API in one shape: { error: { code, message, details? } }
function sendError(res, status, code, message, details) {
  res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
}

export function methodNotAllowed(message) {
  return (req, res) => sendError(res, 405, 'METHOD_NOT_ALLOWED', message, { method: req.method });
}

export function notFoundHandler(req, res) {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} does not exist.`);
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return sendError(res, err.status, err.code, err.message, err.details);

  // Raised by express.json()
  if (err.type === 'entity.parse.failed') return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON.');
  if (err.type === 'entity.too.large') return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');

  // Postgres numeric_value_out_of_range: a balance would exceed NUMERIC(18,2)
  if (err.code === '22003') {
    return sendError(res, 422, 'AMOUNT_OUT_OF_RANGE', 'Resulting balance exceeds the supported range.');
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}
