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

// const uri = process.env.REACT_APP_DB_URI;
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
    const notificationCollections = client
      .db("WeShare")
      .collection("allNotifications");

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
      const jwtToken = jwt.sign(userEmail, secret, { expiresIn: "10h" });
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
          .sort({ commentDate: -1 })
          .toArray();

        const newsFeed = { feeds: result, comments };
        res.send(newsFeed);
      }
    });

    app.get("/viewpostDetails", jwtVerify, userVerify, async (req, res) => {
      const postId = req.query.id;
      const query = { _id: ObjectId(postId) };
      const postDetails = await postsCollection.findOne(query);

      if (postDetails) {
        const postAuthorEmail = postDetails.user;
        const filter = { email: postAuthorEmail };

        const postAuthorProfile = await usersCollection.findOne(filter);

        if (postAuthorProfile) {
          const query = { postId: postId };
          const postComments = await commentsCollection
            .find(query)
            .sort({ commentDate: -1 })
            .toArray();
          const postData = { postDetails, postAuthorProfile, postComments };
          res.send(postData);
        }
      }
    });

    app.get("/findUser", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.userEmail;
      const query = { email: userEmail };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.put("/setNewReact", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const id = req.query.id;
      const updatedReact = req.body;

      const query = { _id: ObjectId(id) };
      const post = await postsCollection.findOne(query);

      const remainUser = post?.react?.filter(
        (emoji) => emoji.userEmail !== userEmail
      );
      const allReactUser = [...remainUser, updatedReact];

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          react: allReactUser,
        },
      };
      const result = await postsCollection.updateOne(query, updateDoc, options);

      if (result) {
        const massege = { ...updatedReact, receiverName: post.user };
        const query = { postId: id };
        const oldMassege = await notificationCollections.findOne(query);

        if (oldMassege) {
          const oldReact = await notificationCollections.deleteOne(query);
        }
        const result = await notificationCollections.insertOne(massege);
        res.send(result);
      }
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
      const query = { email: authorEmail };

      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/findUserProfile", jwtVerify, userVerify, async (req, res) => {
      const id = req.query.id;
      const query = { _id: ObjectId(id) };

      const result = await usersCollection.findOne(query);

      res.send(result);
    });

    app.get("/viewProfile", jwtVerify, userVerify, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const result = await usersCollection.findOne(query);

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
      res.send(result);
    });
    app.put("/findUserWork", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const updateWork = req.body;

      const query = { email: userEmail };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          work: updateWork,
        },
      };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.put("/findUserLivien", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const updateLiveinCity = req.body;

      const query = { email: userEmail };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          livein: updateLiveinCity,
        },
      };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.put("/findUserMobile", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.email;
      const updateMobile = req.body;

      const query = { email: userEmail };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          mobile: updateMobile,
        },
      };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });
    app.put(
      "/findUserBirthDayGenger",
      jwtVerify,
      userVerify,
      async (req, res) => {
        const userEmail = req.query.email;
        const updateInfo = req.body;
        const birthday = { date: updateInfo.birthDay };
        const gender = updateInfo.gender;

        const query = { email: userEmail };

        const options = { upsert: true };
        const updateDoc = {
          $set: {
            gender: gender,
            birthday: birthday,
          },
        };

        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    app.put(
      "/userCoverPhotoUpdate",
      jwtVerify,
      userVerify,
      async (req, res) => {
        const userEmail = req.query.email;
        const coverPhotoUrl = req.body.url;

        const query = { email: userEmail };

        const options = { upsert: true };
        const updateDoc = {
          $set: {
            coverPhoto: coverPhotoUrl,
          },
        };

        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );

        if (result.modifiedCount) {
          const userData = await usersCollection.findOne(query);
          res.send(userData);
        }
      }
    );

    app.put(
      "/userProfilePhotoUpdate",
      jwtVerify,
      userVerify,
      async (req, res) => {
        const userEmail = req.query.email;
        const newPostData = req.body;
        const photoUrl = newPostData.image;

        const query = { email: userEmail };

        const options = { upsert: true };
        const updateDoc = {
          $set: {
            photoUrl: photoUrl,
          },
        };

        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );

        if (result.modifiedCount) {
          const newPost = await postsCollection.insertOne(newPostData);
          const userData = await usersCollection.findOne(query);
          res.send(userData);
        }
      }
    );

    app.get("/profileTramlinefeed", jwtVerify, userVerify, async (req, res) => {
      const userId = req.query.id;
      const query = { _id: ObjectId(userId) };
      const viewUser = await usersCollection.findOne(query);

      if (viewUser) {
        const filter = { user: viewUser.email };
        const userPost = await postsCollection
          .find(filter)
          .sort({ date: -1 })
          .toArray();

        if (userPost) {
          const filter = {};
          const allComments = await commentsCollection.find(filter).toArray();

          const tramlineData = {
            viewUser,
            posts: userPost,
            comments: allComments,
          };
          res.send(tramlineData);
        }
      }
    });

    app.get("/getNotifications", jwtVerify, userVerify, async (req, res) => {
      const userEmail = req.query.userEmail;
      const query = { receiverName: userEmail };

      const notification = await notificationCollections.find(query).toArray();

      res.send(notification);
    });
    // ___________________________________________________________________
    //                              Developer Section
    // ___________________________________________________________________

    const emojiCollections = client.db("WeShare").collection("emojis");

    app.post("/addEmoji", jwtVerify, async (req, res) => {
      const developerEmail = req.query.userEmail;
      const emojiData = req.body;

      if (developerEmail === "shohag@roy.com") {
        const result = await emojiCollections.insertOne(emojiData);
        res.send(result);
      } else {
        res.send({ massege: "authoraization error" });
      }
    });

    // updated function
    app.get("/getEmoji", jwtVerify, userVerify, async (req, res) => {
      const query = {};
      const result = await emojiCollections
        .find(query)
        .sort({ emojiSerial: 1 })
        .toArray();
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
