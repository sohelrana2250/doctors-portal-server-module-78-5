const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const httpStatus = require("http-status");
const {
  specific_data,
  update_data,
  post_data,
  delete_data,
} = require("./reuseable_method/reuseable_function");
const { TCategorie } = require("./utilites/T_Categorie");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.twtll.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.witzbq4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// createdAt: new Date(),
//updatedAt: new Date()

/*function sendBookingEmail(booking) {
    const { email, treatment, appointmentDate, slot } = booking;

    const auth = {
        auth: {
          api_key: process.env.EMAIL_SEND_KEY,
          domain: process.env.EMAIL_SEND_DOMAIN
        }
      }
      
      const transporter = nodemailer.createTransport(mg(auth));

    
    // let transporter = nodemailer.createTransport({
    //     host: 'smtp.sendgrid.net',
    //     port: 587,
    //     auth: {
    //         user: "apikey",
    //         pass: process.env.SENDGRID_API_KEY
    //     }
    // });
      console.log('sending email', email)
    transporter.sendMail({
        from: "jhankar.mahbub2@gmail.com", // verified sender email
        to: email || 'jhankar.mahbub2@gmail.com', // recipient email
        subject: `Your appointment for ${treatment} is confirmed`, // Subject line
        text: "Hello world!", // plain text body
        html: `
        <h3>Your appointment is confirmed</h3>
        <div>
            <p>Your appointment for treatment: ${treatment}</p>
            <p>Please visit us on ${appointmentDate} at ${slot}</p>
            <p>Thanks from Doctors Portal.</p>
        </div>
        
        `, // html body
    }, function (error, info) {
        if (error) {
            console.log('Email send error', error);
        } else {
            console.log('Email sent: ' + info);
        }
    });
}*/

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctorsPortal")
      .collection("AvailableApointment");
    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");
    const usersCollection = client.db("doctorsPortal").collection("users");
    const doctorsCollection = client.db("doctorsPortal").collection("doctors");
    const paymentsCollection = client
      .db("doctorsPortal")
      .collection("payments");

    // NOTE: make sure you use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Use Aggregate to query multiple collection and then merge data
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();

      // get the bookings of the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      // code carefully :D
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(options);
    });

    app.get("/post", async (req, res) => {
      const result = await appointmentOptionCollection.insertOne({
        name: "S M Salman",
      });
      res.send(result);
    });

    app.get("/v2/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const options = await appointmentOptionCollection
        .aggregate([
          {
            $lookup: {
              from: "bookings",
              localField: "name",
              foreignField: "treatment",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$appointmentDate", date],
                    },
                  },
                },
              ],
              as: "booked",
            },
          },
          {
            $project: {
              name: 1,
              price: 1,
              slots: 1,
              booked: {
                $map: {
                  input: "$booked",
                  as: "book",
                  in: "$$book.slot",
                },
              },
            },
          },
          {
            $project: {
              name: 1,
              price: 1,
              slots: {
                $setDifference: ["$slots", "$booked"],
              },
            },
          },
        ])
        .toArray();
      res.send(options);
    });

    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentOptionCollection.find(query).toArray();
      res.send(result);
    });

    /***
     * API Naming Convention
     * app.get('/bookings')
     * app.get('/bookings/:id')
     * app.post('/bookings')
     * app.patch('/bookings/:id')
     * app.delete('/bookings/:id')
     */

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };

      const alreadyBooked = await bookingsCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingsCollection.insertOne(booking);
      //booking implement upcomming days
      //sendBookingEmail(booking)
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      // TODO: make sure you do not enter duplicate user email
      // only insert users if the user doesn't exist in the database
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // temporary to update price field on appointment options
    // app.get('/addPrice', async (req, res) => {
    //     const filter = {}
    //     const options = { upsert: true }
    //     const updatedDoc = {
    //         $set: {
    //             price: 99
    //         }
    //     }
    //     const result = await appointmentOptionCollection.updateMany(filter, updatedDoc, options);
    //     res.send(result);
    // })

    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });

    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      // start reansaction roll back
      const session = client.startSession();
      try {
        session.startTransaction();
        const doctor = req.body;
        const createdBy = req.decoded.email;
        const result = await doctorsCollection.insertOne(
          {
            createdBy,
            ...doctor,
          },
          { session }
        );
        if (!result) {
          throw new Error("Session is Faield Doctor Collextion");
        }
        const createUser = {
          name: req.body.name,
          email: req.body.email,
          role: process.env.USER_ROLE,
        };
        const User = await usersCollection.insertOne(createUser, { session });
        if (!User) {
          throw new Error("Session is Failed User Collection");
        }
        await session.commitTransaction();
        await session.endSession();
        return res.status(httpStatus.CREATED).send({
          success: true,
          message: "Successfully Created Doctor",
          status: httpStatus.CREATED,
          data: result,
        });
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
      }
    });

    app.get(
      "/specific/doctors/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const query = {
          _id: new ObjectId(`${id}`),
        };
        specific_data(doctorsCollection, query)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              status: httpStatus.OK,
              message: "Successfuly Get Specific Data",
              success: true,
              data: result,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );
    app.patch(
      "/update/doctor/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const data = req.body;
        const filter = {
          _id: new ObjectId(`${id}`),
        };
        const updateDoc = {
          $set: {
            name: data.name,
            medicalCollege: data.medicalCollege,
            registeredDoctor: data.registeredDoctor,
            phoneNumber: data.phoneNumber,
            gender: data.gender,
            experience: data.experience,
            appointmentfee: data.appointmentfee,
            currentWorkingPlace: data.currentWorkingPlace,
            designation: data.designation,
          },
        };
        update_data(filter, updateDoc, doctorsCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              status: httpStatus.OK,
              message: "Successfully Updated",
              success: true,
              data: result,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );

    app.put(
      "/doctor/speciality/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const specialist = req.body;
        const filter = { _id: new ObjectId(`${id}`) };
        const updateDoc = {
          $set: {
            specialist,
          },
        };
        update_data(filter, updateDoc, doctorsCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Specilish Added",
              status: httpStatus.OK,
              data: result,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );

    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    });

    // create Teatment categorie
    app.get(
      "/all_teatment_categorie",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const categorie = await appointmentOptionCollection
          .find({})
          .project({ name: 1 })
          .toArray();
        const categorieNames = categorie.map((cat) => cat.name);
        const filteredTCategorie = TCategorie.filter(
          (tc) => !categorieNames.includes(tc)
        );
        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfuly Get All Categorie",
          status: httpStatus.OK,
          data: filteredTCategorie,
        });
      }
    );

    // create appoint sloat
    app.post(
      "/create_appointment_sloat",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        post_data(appointmentOptionCollection, req.body)
          .then((resutl) => {
            return res.status(httpStatus.CREATED).send({
              status: httpStatus.CREATED,
              message: "Appointment Create Successfully",
              success: true,
              data: resutl,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );

    // update appointment --->admin
    app.put(
      "/admin/updateappoinment/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const data = req.body;
        const filter = {
          _id: new ObjectId(`${id}`),
        };
        const updateDoc = {
          $set: {
            name: data?.name,
            price: data?.price,
          },
        };

        update_data(filter, updateDoc, appointmentOptionCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Successfuly Updated Appointment",
              data: result,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );
    // delete appointment
    app.delete(
      "/admin/delete_appointment/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        delete_data(id, appointmentOptionCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Deleted Successfuly Appointment Sloat",
              data: result,
            });
          })
          .catch((error) => {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
              success: false,
              message: error?.message,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          });
      }
    );
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
