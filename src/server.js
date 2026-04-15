const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const dashboardRoutes = require("./routes/dashboard");
const { injectAuthState } = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(injectAuthState);

app.get("/", (req, res) => {
  return res.redirect("/dashboard");
});
app.use(dashboardRoutes);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Not Found",
    message: "The page you requested does not exist."
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
