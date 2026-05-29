export interface HttpStatus {
  code: number;
  message: string;
  description: string;
}

export const HTTP_STATUSES: HttpStatus[] = [
  { code: 100, message: 'Continue', description: 'The server has received the request headers and the client should proceed to send the body.' },
  { code: 101, message: 'Switching Protocols', description: 'The requester has asked the server to switch protocols.' },
  { code: 103, message: 'Early Hints', description: 'Used to return some response headers before final HTTP message.' },
  { code: 200, message: 'OK', description: 'Standard response for successful HTTP requests.' },
  { code: 201, message: 'Created', description: 'The request has been fulfilled and a new resource created.' },
  { code: 202, message: 'Accepted', description: 'The request has been accepted for processing, but not completed.' },
  { code: 204, message: 'No Content', description: 'The server successfully processed the request and is not returning content.' },
  { code: 206, message: 'Partial Content', description: 'The server is delivering only part of the resource (range request).' },
  { code: 301, message: 'Moved Permanently', description: 'This and all future requests should be directed to the given URI.' },
  { code: 302, message: 'Found', description: 'Tells the client to look at another URL (temporary redirect).' },
  { code: 303, message: 'See Other', description: 'The response can be found under another URI using GET.' },
  { code: 304, message: 'Not Modified', description: 'The resource has not been modified since the version specified by request headers.' },
  { code: 307, message: 'Temporary Redirect', description: 'Repeat the request to another URI with the same method.' },
  { code: 308, message: 'Permanent Redirect', description: 'The request and all future requests should be repeated using another URI.' },
  { code: 400, message: 'Bad Request', description: 'The server cannot process the request due to a client error.' },
  { code: 401, message: 'Unauthorized', description: 'Authentication is required and has failed or not been provided.' },
  { code: 402, message: 'Payment Required', description: 'Reserved for future use; sometimes used by APIs for quota/billing.' },
  { code: 403, message: 'Forbidden', description: 'The server understood the request but refuses to authorize it.' },
  { code: 404, message: 'Not Found', description: 'The requested resource could not be found.' },
  { code: 405, message: 'Method Not Allowed', description: 'The request method is not supported for the resource.' },
  { code: 406, message: 'Not Acceptable', description: 'The resource cannot produce content matching the Accept headers.' },
  { code: 408, message: 'Request Timeout', description: 'The server timed out waiting for the request.' },
  { code: 409, message: 'Conflict', description: 'The request conflicts with the current state of the server.' },
  { code: 410, message: 'Gone', description: 'The resource is no longer available and will not be available again.' },
  { code: 413, message: 'Payload Too Large', description: 'The request is larger than the server is willing to process.' },
  { code: 415, message: 'Unsupported Media Type', description: 'The request entity has a media type the server does not support.' },
  { code: 418, message: "I'm a teapot", description: 'The server refuses to brew coffee because it is, permanently, a teapot.' },
  { code: 422, message: 'Unprocessable Entity', description: 'The request was well-formed but had semantic errors.' },
  { code: 429, message: 'Too Many Requests', description: 'The user has sent too many requests in a given amount of time (rate limiting).' },
  { code: 431, message: 'Request Header Fields Too Large', description: 'Header fields are too large for the server to process.' },
  { code: 451, message: 'Unavailable For Legal Reasons', description: 'The resource is unavailable due to legal demands.' },
  { code: 500, message: 'Internal Server Error', description: 'A generic error message for an unexpected server condition.' },
  { code: 501, message: 'Not Implemented', description: 'The server does not recognize the request method.' },
  { code: 502, message: 'Bad Gateway', description: 'The server, acting as a gateway, received an invalid response upstream.' },
  { code: 503, message: 'Service Unavailable', description: 'The server is not ready to handle the request (overloaded or down).' },
  { code: 504, message: 'Gateway Timeout', description: 'The gateway did not receive a timely response from the upstream server.' },
  { code: 505, message: 'HTTP Version Not Supported', description: 'The server does not support the HTTP protocol version used.' },
  { code: 511, message: 'Network Authentication Required', description: 'The client needs to authenticate to gain network access.' },
];

export function statusClass(code: number): string {
  if (code < 200) return 'Informational';
  if (code < 300) return 'Success';
  if (code < 400) return 'Redirection';
  if (code < 500) return 'Client Error';
  return 'Server Error';
}
