const express = require("express");
const cors = require("cors");
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const stripe = require('stripe');
const port = process.env.PORT || 3000;

//middlewire
app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m4ciotl.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("ScholarshipStream");

 
    //Users Related APIs

        const usersCollection = db.collection("Users");
    app.post("/users", async (req, res) => {
      const newUser = req.body;

      const existingUser = await usersCollection.findOne({
        email: newUser.email,
      });

      if (existingUser) {
        return res.send({
          message: "User already exists",
        });
      }

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

     app.get("/users", async (req, res) => {
      const users = usersCollection.find();
      const result = await users.toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;

      const updatedRole = {
        $set: { role },
      };
      const result = await usersCollection.updateOne({ email }, updatedRole);
      res.send(result);
    });

    app.patch("/users/profile/:id", async (req, res) => {
      const id = req.params.id;
      const { name, photoURL } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            name,
            photoURL,
          },
        }
      );

      res.send(result);
    });

    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //SCHOLARSHIP RELATED APIs

    const scholarshipsCollection = db.collection("Scholarships");
    app.post("/scholarships", async (req, res) => {
      const newScholarship = req.body;
      newScholarship.createdAt = new Date();
      const result = await scholarshipsCollection.insertOne(newScholarship);
      res.send(result);
    });

    app.get("/scholarships", async (req, res) => {
      try {
        const { search, category, order, page, limit } = req.query;

        const matchStage = {};

        if (search) {
          matchStage.$or = [
            { scholarshipName: { $regex: search, $options: "i" } },
            { universityName: { $regex: search, $options: "i" } },
            { degree: { $regex: search, $options: "i" } },
          ];
        }

        if (category) {
          matchStage.scholarshipCategory = category;
        }

        const sortOrder = order === "descending" ? -1 : 1;

        const pipeline = [
          { $match: matchStage },

          {
            $addFields: {
              applicationFeesNumber: {
                $toDouble: "$applicationFees",
              },
            },
          },

          {
            $sort: {
              applicationFeesNumber: sortOrder,
            },
          },
        ];

        if (page && limit) {
          const pageNumber = Number(page);
          const limitNumber = Number(limit);
          const skip = (pageNumber - 1) * limitNumber;

          const countPipeline = [{ $match: matchStage }, { $count: "total" }];

          const countResult = await scholarshipsCollection
            .aggregate(countPipeline)
            .toArray();

          const total = countResult[0]?.total || 0;

          pipeline.push({ $skip: skip }, { $limit: limitNumber });

          const data = await scholarshipsCollection
            .aggregate(pipeline)
            .toArray();

          return res.send({
            data,
            total,
            totalPages: Math.ceil(total / limitNumber),
            currentPage: pageNumber,
          });
        }

        const result = await scholarshipsCollection
          .aggregate(pipeline)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.send({ message: "Failed to fetch scholarships" });
      }
    });

  } finally {
    await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Scholar Stream");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
