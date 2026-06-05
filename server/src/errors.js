class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function badRequest(message) {
  return new HttpError(400, message);
}

function notFound(message) {
  return new HttpError(404, message);
}

function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message);
}

module.exports = {
  HttpError,
  badRequest,
  notFound,
  unauthorized
};
