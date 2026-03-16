const express = require("express");

const router = express.Router();

function safeEquals(a, b) {
  return typeof a === "string" && typeof b === "string" && a === b;
}

router.get("/login", (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect("/dashboard");
  }

  return res.render("login", {
    title: "Admin Login",
    error: null,
    submittedEmail: ""
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return res.status(500).render("login", {
      title: "Admin Login",
      error: "Server is missing ADMIN_EMAIL/ADMIN_PASSWORD environment variables.",
      submittedEmail: email || ""
    });
  }

  if (!safeEquals(email, expectedEmail) || !safeEquals(password, expectedPassword)) {
    return res.status(401).render("login", {
      title: "Admin Login",
      error: "Invalid email or password.",
      submittedEmail: email || ""
    });
  }

  req.session.isAuthenticated = true;
  req.session.user = { email: expectedEmail };

  return res.redirect("/dashboard");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
