const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { query } = require("express");

const port = process.env.POST || 5000;
const app = express();

// jwt secret
const secret = process.env.REACT_APP_JWT_SECRET_ACCESS_TOKEN;

// middleware
app.use(cors());
app.use(express.json());

// all collection

// middleware function
const jwtVerify = (req, res, next) => {
  const bearerToken = req.headers.authorization;

  if (!bearerToken) {
    return res.status(401).send({ massege: "unauthorized access" });
  }
  const jwtToken = bearerToken.split(" ")[1];

  jwt.verify(jwtToken, secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({ massege: "unauthorized access" });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};

// database
// const uri = process.env.DATABASE_URI;
const uri = "mongodb://localhost:27017";

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
const run = async () => {
  try {
    const usersCollection = client.db("WeShare").collection("users");
    const postsCollection = client.db("WeShare").collection("allPosts");
    const commentsCollection = client.db("WeShare").collection("allComments");

    const userVerify = async (req, res, next) => {
      const verifyEmail = req.decoded.email;
      const query = { email: verifyEmail };
      const result = await usersCollection.findOne(query);

      if (result) {
        next();
      } else {
        return res.status(401).send({ massege: "unauthorized access" });
      }
    };

    const makeProfilePicture = async (req, res, next) => {
      const profilePicture = req.body.isProfilePicture;
      const newProfilePicture = req.body.image;
      const userEmail = req.decoded.email;

      if (profilePicture) {
        const query = { email: userEmail };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            photoUrl: newProfilePicture,
          },
        };
        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );
      }
      next();
    };

    // creact user
    app.post("/createUser", async (req, res) => {
      const userInfo = req.body;
      const userEmail = { email: userInfo.email };
      const jwtToken = jwt.sign(userEmail, secret, { expiresIn: "3h" });
      const result = await usersCollection.insertOne(userInfo);
      res.send({ jwtToken });
    });

    app.get("/jwtCrateLoginUser", async (req, res) => {
      const userEmail = { email: req.query.email };
      const jwtToken = jwt.sign(userEmail, secret, { expiresIn: "3h" });
      res.send({ jwtToken });
    });

    app.post(
      "/createNewPost",
      jwtVerify,
      userVerify,
      makeProfilePicture,
      async (req, res) => {
        const newPostData = req.body;
        const result = await postsCollection.insertOne(newPostData);
        res.send(result);
      }
    );

    app.get("/allFeedsData", jwtVerify, userVerify, async (req, res) => {
      const query = {};
      const result = await postsCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      if (result) {
        const comments = await commentsCollection
          .find(query)
          .sort({ commentDate: 1 })
          .toArray();

        const newsFeed = { feeds: result, comments };
        res.send(newsFeed);
      }
    });
    app.get("/findUser", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.userEmail;
      const query = { email: userEmail };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.put("/setNewReact", jwtVerify, userVerify, async (req, res) => {
      const id = req.query.id;
      const updatedReact = req.body;

      const query = { _id: ObjectId(id) };

      const post = await postsCollection.findOne(query);
      const currentReact = post.totalReact + 1;

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          totalReact: currentReact,
          react: updatedReact,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc, options);
      console.log(result);
      res.send(result);
    });
    app.post("/addNewComment", jwtVerify, userVerify, async (req, res) => {
      const id = req.query.id;
      const newComment = req.body;
      const query = { _id: ObjectId(id) };

      const post = await commentsCollection.insertOne(newComment);
      const countComment = await postsCollection.findOne(query);
      const correntComments = countComment.totalComments + 1;

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          totalComments: correntComments,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc, options);
      console.log(result);
      res.send(result);
    });

    app.get("/allComments", jwtVerify, userVerify, async (req, res) => {
      const id = req.query.id;
      const query = { postId: id };

      const result = await commentsCollection
        .find(query)
        .sort({ commentDate: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/commentUsers", jwtVerify, userVerify, async (req, res) => {
      const authorEmail = req.query.authorEmail;
      console.log(authorEmail);
      const query = { email: authorEmail };

      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.get("/findUserProfile", jwtVerify, userVerify, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.put("/findUserSchool", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const updateSchool = req.body;

      const query = { email: userEmail };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          school: updateSchool,
        },
      };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      console.log(result);
      console.log(result);
      res.send(result);
    });

    app.put("/findUserCollege", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const updateCollege = req.body;

      const query = { email: userEmail };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          college: updateCollege,
        },
      };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      console.log(result);
      console.log(result);
      res.send(result);
    });
  } finally {
  }
};

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("WeShare Media - Server is Running");
});

app.listen(port, () => {
  console.log(`WeShare Media - Server is Running port: ${port}`);
});
