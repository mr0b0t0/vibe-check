import express from "express";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (_req, res) => res.status(200).send("ok"));

app.get("/login", (_req, res) => {
  res.send(`
    <html><body>
      <h1>Login</h1>
      <form name="login" method="post" action="/login">
        <input name="email" />
        <input name="password" type="password" />
        <button type="submit">Sign in</button>
      </form>
    </body></html>
  `);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@example.com" && password === "adminpass") {
    return res.redirect("/dashboard");
  }
  res.status(401).send("Invalid");
});

app.get("/dashboard", (_req, res) => res.send("Welcome admin"));

app.get("/contacts", (_req, res) => {
  res.send(`
    <html><body>
      <h1>Contacts</h1>
      <button id="new-contact">New Contact</button>
      <div id="flash"></div>
      <script>
        document.getElementById('new-contact').addEventListener('click', () => {
          document.getElementById('flash').innerText = 'Contact created';
        });
      </script>
    </body></html>
  `);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`[webapp] http://localhost:${port}`));
