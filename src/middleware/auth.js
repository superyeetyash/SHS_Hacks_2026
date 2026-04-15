function requireAuth(req, res, next) {
  return next();
}

function injectAuthState(req, res, next) {
  res.locals.isAuthenticated = false;
  res.locals.currentUser = null;
  return next();
}

module.exports = {
  requireAuth,
  injectAuthState
};
