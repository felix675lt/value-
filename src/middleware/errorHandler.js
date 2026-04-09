function errorHandler(err, req, res, _next) {
  console.error(err.stack || err);
  const status = err.status || 500;
  // [MEDIUM] 스택 트레이스는 명시적 development 모드에서만 노출
  const isDev = process.env.NODE_ENV === 'development';
  res.status(status).json({
    error: status === 500 && !isDev ? '서버 오류가 발생했습니다.' : err.message,
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
