const sanitizeHtml = require('sanitize-html');

// [LOW] XSS 방지 — 텍스트 필드에서 HTML/Script 태그 제거
function sanitizeStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' ? sanitizeStrings(item) : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeStrings(req.body);
  }
  next();
}

module.exports = sanitizeBody;
