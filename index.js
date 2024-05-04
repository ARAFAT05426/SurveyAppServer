const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5426;

// Middleware
app.use(cors());
app.use(express.json());

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
    console.log("Connected to MongoDB!");
  } finally {
    // Ensure the client will close when finished or errors occur
    await client.close();
  }
}
connectToMongoDB().catch(console.error);

// Routes
app.get("/", (req, res) => {
  res.send("Hello NODE");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
