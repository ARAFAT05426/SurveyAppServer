const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const verifyToken = require("./verify");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    await client.connect();
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
    // Verify Surveyor middleware
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await users.findOne(query);
      if (!result || result?.role !== "admin") {
        return res.status(401).send({ message: "unauthorized access!!" });
      }
      next();
    };
    const verifySurveyor = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await users.findOne(query);
      if (!result || result?.role !== "surveyor") {
        return res.status(401).send({ message: "unauthorized access!!" });
      }
      next();
    };

    // PAYMENT INTENT
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const priceInCent = Math.round(parseFloat(price) * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // SURVEY
    app.post("/survey", async (req, res) => {
      const data = req.body;
      const result = await surveys.insertOne(data);
      res.send(result);
    });

    app.get("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const result = await surveys.findOne({ _id: new ObjectId(surveyId) });
      res.send(result);
    });

    app.put("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const updatedData = req.body;
      const result = await surveys.updateOne(
        { _id: new ObjectId(surveyId) },
        { $set: updatedData }
      );
      res.send(result);
    });
    app.patch("/survey/vote/:id", async (req, res) => {
      const surveyId = req.params.id;
      const { questions, voter, voterEmail } = req.body;
      const questionUpdate = await questions.map(
        async ({ question, selectedOption }) => {
          return surveys.updateOne(
            {
              _id: new ObjectId(surveyId),
              "questions.question": question,
              "questions.options.option": selectedOption,
            },
            { $inc: { "questions.$.options.$[opt].votecount": 1 } },
            { arrayFilters: [{ "opt.option": selectedOption }] }
          );
        }
      );
      const addVoter = await surveys.updateOne(
        { _id: new ObjectId(surveyId) },
        {
          $push: {
            voters: { name: voter, email: voterEmail, timestamp: Date.now() },
          },
        }
      );
      const result = { questionUpdate, addVoter };
      res.send(result);
    });

    app.patch("/survey/comment/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const comment = req.body;
      const updatedDoc = { $push: { comments: comment } };
      const result = await surveys.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const result = await surveys.deleteOne({ _id: new ObjectId(surveyId) });
      res.send(result);
    });

    app.get("/survey", async (req, res) => {
      const all = req.query.all;
      const published = req.query.published;
      const result = await surveys.find({status: "publish"}).toArray();
      res.send(result);
    });
    app.get("/survey/voters/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const survey = await surveys.findOne(query, {
        projection: { title: 1, voters: 1, _id: 0 },
      });
      res.send(survey);
    });

    app.get("/survey/mysurvey/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
    });
    // USERS
    app.get("/user", verifyToken, verifyAdmin, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await users.findOne({ email });
      res.send(result);
    });
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const options = { upsert: true };
      const isExist = await users.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      console.log(user);
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await users.updateOne(query, updateDoc, options);
      res.send(result);
    });
    //update a user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const { role, payment } = req.body;
      const query = { email };
      const updateDoc = {
        $set: { role: role, payment: payment, timestamp: Date.now() },
      };
      const result = await users.updateOne(query, updateDoc);
      res.send(result);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

connectToMongoDB().catch(console.error);

// Routes
app.get("/", (req, res) => {
  res.send("Hello KwikPoll");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
