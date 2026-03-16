function requireAuth(req, res, next) {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  }
  return next();
}

function injectAuthState(req, res, next) {
  res.locals.isAuthenticated = Boolean(req.session.isAuthenticated);
  res.locals.currentUser = req.session.user || null;
  return next();
}

module.exports = {
  requireAuth,
  injectAuthState
};
