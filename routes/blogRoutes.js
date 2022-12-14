const mongoose = require("mongoose");
const requireLogin = require("../middlewares/requireLogin");
const redis = require("redis");
const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
const Blog = mongoose.model("Blog");

const util = require("util");

client.get = util.promisify(client.get);
client.del = util.promisify(client.del);

module.exports = (app) => {
  app.get("/api/blogs/:id", requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id,
    });

    res.send(blog);
  });

  app.get("/api/blogs", requireLogin, async (req, res) => {
    //Do we have any cached data in redis related to this query

    const cachedBlogs = await client.get(req.user.id);

    //If yes, then respond to the request right away and return

    if (cachedBlogs) {
      console.log("Serving from cache...");
      return res.send(JSON.parse(cachedBlogs));
    }

    //If no, we need to respond to the request and update our cache to store the data
    const blogs = await Blog.find({ _user: req.user.id });

    console.log("Serving from MongoDB...");
    res.send(blogs);

    client.set(req.user.id, JSON.stringify(blogs));
  });

  app.post("/api/blogs", requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id,
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }

    //client.flushall(); //flushes entire cache database
    client.del(req.user.id);
    console.log("Cache cleared");
  });
};
