if (process.NODE_ENV === "development" || process.NODE_ENV === undefined) {
  require("dotenv").config();
}

const WPAPI = require("wpapi/superagent");
const wp = new WPAPI({
  endpoint: `${process.env.WP_URL}/wp-json`,
  username: process.env.WP_USER,
  password: process.env.WP_PASS,
});

const loggly = require("loggly").createClient({
  token: process.env.LOGGLY_TOKEN,
  subdomain: process.env.LOGGLY_SUBDOMAIN,
  auth: {
    username: process.env.LOGGLY_USER,
    password: process.env.LOGGLY_PASS,
  },
  json: true,
});

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.set("view engine", "pug");

const urlencodedParser = bodyParser.urlencoded({ extended: false });

async function fetchTitles() {
  let posts = await wp
    .posts()
    .status(["draft", "publish"])
    .perPage(10)
    .page(1)
    .get();
  return posts.map((post) => post.title.rendered);
}

app.get("/", async function (req, res) {
  res.render("index", { titles: await fetchTitles() });
});

app.post("/create", urlencodedParser, async function (req, res) {
  let body = req.body;
  await wp.posts().create({
    // "title" and "content" are the only required properties
    title: body.title,
    content: body.content,
    // just to avoid posting something private in production!
    status: "draft",
  });

  logglyFormatter("A new post was created from the client app!", {
    level_name: "INFO",
    path: "POST /create",
    User: "frontend",
  });

  res.render("index", { titles: await fetchTitles() });
});

function logglyFormatter(message, data) {
  let logglyData = {
    message: message,
    level_name: data.level_name,
    context: {
      path: data.path,
      User: data.User,
    },
  };
  loggly.log(logglyData);
}

app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:3000`);
});
