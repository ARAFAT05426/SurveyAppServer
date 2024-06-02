const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5426;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(cookieParser());
// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b5qg8rw.mongodb.net`;

// MongoDB Client setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    // await client.connect();
    const KwikPolls = client.db("KwikPolls");
    const users = KwikPolls.collection("users");
    const surveys = KwikPolls.collection("surveys");
    console.log("Connected to MongoDB!");
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ success: true, token });
    });
    app.put("/user", async (req, res) => {
      const user = req.body;

      const query = { email: user?.email };
      // check if user already exists in db
      const isExist = await users.findOne(query);
      if (isExist) {
        if (user.status === "Requested") {
          // if existing user try to change his role
          const result = await users.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          // if existing user login again
          return res.send(isExist);
        }
      }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await users.updateOne(query, updateDoc, options);
      res.send(result);
    });
    // SURVEY
    app.post("/survey", async (req, res) => {
      const data = req.body;
      const result = await surveys.insertOne(data);
      res.send(result);
    });

    app.get("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      console.log(surveyId);
      const result = await surveys.findOne({ _id: new ObjectId(surveyId) });
      res.send(result);
    });
    app.put("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const updatedData = req.body;
      const result = await surveys.updateOne({ _id: new ObjectId(surveyId) }, { $set: updatedData });
      res.send(result);
    });
    app.delete("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const result = await surveys.deleteOne({ _id: new ObjectId(surveyId)});
      res.send(result);
    });
    app.get("/survey", async (req, res) => {
      const query = req.query.limit;
      const result = await surveys.find().toArray();
      res.send(result);
    });
  } finally {
    // Ensure the client will close when finished or errors occur
    // await client.close();
  }
}
connectToMongoDB().catch(console.error);

// Routes
app.get("/", (req, res) => {
  res.send("Hello KwickPoll");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
