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
    const verifySurveyor = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await user.findOne(query);
      console.log(result?.role);
      if (!result || result?.role !== "surveyor") {
        return res.status(401).send({ message: "unauthorized access!!" });
      }

      next();
    };
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await users.findOne(query);
      if (isExist) {
        if (user.status === "Requested") {
          const result = await users.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      const options = { upsert: true };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await users.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // PAYMENT INTENT
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const priceInCent = Math.round(parseFloat(price) * 100);
      if (!price || priceInCent < 1)
        return res.status(400).send({ error: "Invalid price" });

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: priceInCent,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
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
    app.patch("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const { questions, voter } = req.body;
      console.log(voter);
      const questionUpdate = await questions.map(
        async ({ question, selectedOption }) => {return surveys.updateOne(
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
        { $push: { voters: { email: voter, timestamp: Date.now() } } }
      );
      const result = { questionUpdate, addVoter };
      res.send(result);
    });

    app.delete("/survey/:id", async (req, res) => {
      const surveyId = req.params.id;
      const result = await surveys.deleteOne({ _id: new ObjectId(surveyId) });
      res.send(result);
    });

    app.get("/survey", async (req, res) => {
      const result = await surveys.find().toArray();
      res.send(result);
    });
    // USERS
    app.get("/user", verifyToken, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await users.findOne({ email });
      res.send(result);
    });
    //update a user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
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
