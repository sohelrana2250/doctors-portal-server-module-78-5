const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const corn = require("node-cron");
const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const {
  specific_data,
  update_data,
  post_data,
  delete_data,
} = require("./reuseable_method/reuseable_function");
const { TCategorie } = require("./utilites/T_Categorie");
const { verifyJWT } = require("./auth/middlewere");
const { sendEmail } = require("./auth/sendEmail");
const { createDoctorContent } = require("./auth/emaildata");
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
    const patientCollection = client.db("doctorsPortal").collection("patient");
    const prescriptionCollection = client
      .db("doctorsPortal")
      .collection("prescription");
    const reviewCollection = client.db("doctorsPortal").collection("reviews");
    const onsiteBookingCollection = client
      .db("doctorsPortal")
      .collection("onsitebookings");
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
    const verifyDoctor = async (req, res, next) => {
      const decodedEmail = req.decoded.email;

      const isItDoctor = await usersCollection.findOne({ email: decodedEmail });
      if (isItDoctor?.role !== "doctor") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    OnsiteUnpaidListOfAppointment = async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      const unPaidAppointments = await onsiteBookingCollection
        .find({
          bookingTime: { $lte: thirtyMinAgo },
          paid: false,
        })
        .project({ _id: 1 })
        .toArray();

      const idsToUpdate = unPaidAppointments.map(
        (appointment) => appointment._id
      );

      if (idsToUpdate.length > 0) {
        await onsiteBookingCollection.updateMany(
          {
            _id: { $in: idsToUpdate },
          },
          { $set: { isBooked: false } },
          { upsert: true }
        );
      }
    };

    const ExprireBookingDateOnsiteAppointment = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expireBooking = await onsiteBookingCollection
        .find({
          createdAt: { $lte: twentyFourHoursAgo },
        })
        .project({
          _id: 1,
        })
        .toArray();

      // delete  booking sloat after 24  hours deaily
      const idsToDelete = expireBooking.map((appointment) => appointment._id);
      await onsiteBookingCollection.deleteMany({
        _id: { $in: idsToDelete },
      });
    };

    const CancleUnpaidAppointments = async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      const unPaidAppointments = await bookingsCollection
        .find({
          bookingTime: { $lte: thirtyMinAgo },
          paid: false,
        })
        .project({ _id: 1 })
        .toArray();

      const idsToUpdate = unPaidAppointments.map(
        (appointment) => appointment._id
      );

      if (idsToUpdate.length > 0) {
        await bookingsCollection.updateMany(
          {
            _id: { $in: idsToUpdate },
          },
          { $set: { isBooked: false } },
          { upsert: true }
        );
      }
    };

    const CancelExprireBookingDate = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expireBooking = await bookingsCollection
        .find({
          createdAt: { $lte: twentyFourHoursAgo },
        })
        .project({
          _id: 1,
        })
        .toArray();

      // delete  booking sloat after 24  hours deaily
      const idsToDelete = expireBooking.map((appointment) => appointment._id);
      await bookingsCollection.deleteMany({
        _id: { $in: idsToDelete },
      });
    };

    // online payment system

    corn.schedule("* * * * *", () => {
      try {
        CancleUnpaidAppointments().catch(console.error);
      } catch (error) {
        console.log(error);
      }
    });
    // "0 0 * * *"
    corn.schedule("* * * * *", () => {
      try {
        CancelExprireBookingDate().catch(console.error);
      } catch (error) {
        console.log(error);
      }
    });
    // onsite payment getway
    corn.schedule("* * * * *", () => {
      try {
        OnsiteUnpaidListOfAppointment().catch(console.error);
      } catch (error) {
        console.log(error);
      }
    });

    corn.schedule("* * * * *", () => {
      try {
        ExprireBookingDateOnsiteAppointment().catch(console.error);
      } catch (error) {
        console.log(error);
      }
    });
    app.get(
      "/appointmentOptions",

      async (req, res) => {
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
      }
    );

    app.get("/post", async (req, res) => {
      const result = await appointmentOptionCollection.insertOne({
        name: "S M Salman",
      });
      res.send(result);
    });

    app.get(
      "/v2/appointmentOptions",
      verifyJWT,
      verifyDoctor,
      async (req, res) => {
        const date = req.query.date;
        const email = req.decoded.email; // Extract email from request body

        try {
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
                          $and: [
                            { $eq: ["$appointmentDate", date] },
                            { $eq: ["$email", email] },
                          ],
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
        } catch (err) {
          console.error(err);
          res
            .status(500)
            .send("An error occurred while fetching appointment options.");
        }
      }
    );

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
      res.send({
        status: httpStatus.OK,
        message: "Successfully Get the Data",
        data: bookings,
      });
    });

    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(`Received ID: ${id}`);

      if (!ObjectId.isValid(id)) {
        return res.status(httpStatus.NOT_FOUND).send({
          success: false,
          message: "Invalid ID format",
          status: httpStatus.NOT_FOUND,
        });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const booking = await bookingsCollection.findOne(query);

        if (booking) {
          return res.send(booking);
        }

        // If no booking found in bookingsCollection, check onsiteBookingCollection
        const onsiteBooking = await onsiteBookingCollection.findOne(query);
        if (onsiteBooking) {
          return res.send(onsiteBooking);
        }

        // If no booking found in either collection
        return res.status(httpStatus.NOT_FOUND).send({
          success: false,
          message: "Booking not found",
          status: httpStatus.NOT_FOUND,
        });
      } catch (error) {
        console.error("Error fetching booking:", error);
        return res.status(httpStatus.SERVICE_UNAVAILABLE).send({
          success: false,
          message: error.message,
          status: httpStatus.SERVICE_UNAVAILABLE,
        });
      }
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const query = {
        appointmentDate: booking.appointmentDate,
        slot: booking.slot,
        email: booking.email,
        treatment: booking.treatment,
      };
      switch (booking.condition) {
        case process.env.ONLINE_BOOKING:
          {
            Reflect.deleteProperty(booking, "condition");
            const isExistDoctorId = await doctorsCollection
              .findOne({
                email: booking.email,
              })
              .then((data) => data._id);
            const doctorSloatBooking = {
              doctorId: isExistDoctorId,
              videoCallingId: uuidv4(),
              status: "INPROGRESS",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            const alreadyBooked = await bookingsCollection
              .find(query)
              .toArray();
            if (alreadyBooked.length) {
              const message = `You already have a booking on ${booking.appointmentDate}`;
              return res.send({ acknowledged: false, message });
            }
            const result = await bookingsCollection.insertOne({
              ...booking,
              ...doctorSloatBooking,
            });

            res.send(result);
          }
          break;
        case process.env.ONSITE_BOOKING:
          {
            const isExistDoctorId = await doctorsCollection
              .findOne({
                email: booking.email,
              })
              .then((data) => data._id);
            const doctorSloatBooking = {
              doctorId: isExistDoctorId,
              status: "INPROGRESS",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            //checked alredy booked or Not
            const alreadyBooked = await onsiteBookingCollection
              .find(query)
              .toArray();
            if (alreadyBooked.length) {
              const message = `You already have a booking on ${booking.appointmentDate}`;
              return res.send({ acknowledged: false, message });
            }
            const result = await onsiteBookingCollection.insertOne({
              ...booking,
              ...doctorSloatBooking,
            });
            res.send(result);
          }
          break;
        default: {
          res.send({
            status: httpStatus.UPGRADE_REQUIRED,
            message: "Onsite And Online Both Request is Faileds",
          });
        }
      }
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

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;

      if (payment.condition === process.env.CONDITION) {
        const session = client.startSession();
        try {
          session.startTransaction();

          const id = payment.bookingId;
          const filter = { _id: ObjectId(id) };
          Reflect.deleteProperty(payment, "bookingId");
          const updatedDoc = {
            $set: {
              paid: true,
              transactionId: payment.transactionId,
              status: "COMPLETED",
            },
          };
          const updatedResult = await onsiteBookingCollection.updateOne(
            filter,
            updatedDoc,
            { upsert: true, session }
          );
          if (!updatedResult) {
            throw new Error("Payment Booking Collection Session Failed");
          }

          const paymentSection = await paymentsCollection.insertOne(payment, {
            session,
          });
          if (!paymentSection) {
            throw new Error("Payment Transaction  Session is Faileds");
          }

          await session.commitTransaction();
          await session.endSession();
          return res.send(paymentSection);
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }

      // started transaction rollbacked
      const session = client.startSession();
      try {
        session.startTransaction();

        const id = payment.bookingId;
        const filter = { _id: ObjectId(id) };
        Reflect.deleteProperty(payment, "bookingId");
        const updatedDoc = {
          $set: {
            paid: true,
            transactionId: payment.transactionId,
            status: "COMPLETED",
          },
        };
        const updatedResult = await bookingsCollection.updateOne(
          filter,
          updatedDoc,
          { upsert: true, session }
        );
        if (!updatedResult) {
          throw new Error("Payment Booking Collection Session Failed");
        }

        const paymentSection = await paymentsCollection.insertOne(payment, {
          session,
        });
        if (!paymentSection) {
          throw new Error("Payment Transaction  Session is Faileds");
        }

        await session.commitTransaction();
        await session.endSession();
        return res.send(paymentSection);
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
      }
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "7d",
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
        const sendemail = createDoctorContent({
          email: doctor.email,
          password: doctor.password,
        });

        const info = await sendEmail(
          doctor.email,
          sendemail.email_body,
          sendemail.subject
        );

        if (!info.messageId) {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        }
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

    app.get("/specific/doctors/:id", verifyJWT, async (req, res) => {
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
    });
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
            district: data.district,
            chamber: data.chamber,
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
    app.get("/doctor/myprofile", verifyJWT, verifyDoctor, async (req, res) => {
      const query = {
        email: req.decoded.email,
      };
      specific_data(doctorsCollection, query)
        .then((result) => {
          return res.send({
            status: httpStatus.OK,
            message: "Successfully Get",
            data: result,
          });
        })
        .catch((error) => {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        });
    });
    app.put(
      "/doctor/update/profile/:id",
      verifyJWT,
      verifyDoctor,
      async (req, res) => {
        const filter = { _id: new ObjectId(`${req.params.id}`) };
        const { name, specialty, currentWorkingPlace, appointmentfee, image } =
          req.body;
        const updateDoc = {
          $set: {
            name,
            specialty,
            currentWorkingPlace,
            appointmentfee,
            image,
          },
        };
        update_data(filter, updateDoc, doctorsCollection)
          .then((result) => {
            return res.send({
              status: httpStatus.OK,
              message: "Profile Successfully Updated",
              data: result,
            });
          })
          .catch((error) => {
            return res.send({
              status: httpStatus.NOT_FOUND,
              message: error?.message,
            });
          });
      }
    );
    // start patient Appointment
    app.get("/patient/bookingSloat", async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "bookings", // the collection to join
            localField: "_id", // field from doctorCollection
            foreignField: "doctorId", // field from bookingCollection
            as: "bookings", // output array field
          },
        },

        {
          $project: {
            name: 1,
            specialty: 1,
            experience: 1,
            appointmentfee: 1,
            image: 1,
            bookings: {
              appointmentDate: 1,
              treatment: 1,
              patient: 1,
              slot: 1,
              price: 1,
              status: 1,
              doctorId: 1,
              createdAt: 1,
              isBooked: 1,
              _id: 1,
            },
          },
        },
      ];
      const mergedData = await doctorsCollection.aggregate(pipeline).toArray();
      res.send(mergedData);
    });
    app.post("/patient/createpatient", verifyJWT, async (req, res) => {
      const data = req.body;
      const email = req.decoded.email;
      const result = await patientCollection.insertOne({ ...data, email });
      res.send({
        status: httpStatus.CREATED,
        message: "Successfully  Recored",
        data: result,
      });
    });
    app.get("/patient/doctorAppointment", async (req, res) => {
      const query = {};
      const result = await doctorsCollection.find(query).toArray();
      res.send(result);
    });
    // my profile
    app.get("/api/v1/my_profile", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const isUserRole = await usersCollection.findOne(
        { email },
        {
          projection: {
            role: 1,
          },
        }
      );
      if (isUserRole?.role === "user") {
        const result = await patientCollection.findOne({ email });

        return res.send({
          status: httpStatus.OK,
          message: "Successfully Get My Profile",
          data: result,
        });
      } else {
        const result = await patientCollection.find({}).toArray();
        return res.send({
          status: httpStatus.OK,
          message: "Successfully Get My Profile",
          data: result,
        });
      }
    });
    app.put("/api/v1/isBookingSloat/:id", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const { id } = req.params;
      const data = req.body;

      const filter = {
        _id: new ObjectId(id),
      };
      const updateDoc = {
        $set: {
          isBooked: data.isBooked,
          patientEmail: email,
          bookingTime: new Date(),
        },
      };
      // console.log(updateDoc);

      try {
        let result;
        if (data.condition === process.env.CONDITION) {
          Reflect.deleteProperty(data, "condition");

          result = await update_data(
            filter,
            updateDoc,
            onsiteBookingCollection
          );
          // console.log("onsite");
          // console.log(result);
        } else {
          result = await update_data(filter, updateDoc, bookingsCollection);
        }

        return res.send({
          status: httpStatus.OK,
          message: "Booking Successful",
          data: result,
        });
      } catch (error) {
        return res.send({
          status: httpStatus.NOT_FOUND,
          message: error?.message,
        });
      }
    });

    app.get("/api/v1/patient/mybooking", verifyJWT, async (req, res) => {
      const email = req.decoded.email;

      const isUserType = await usersCollection.findOne(
        { email },
        {
          projection: {
            role: 1,
          },
        }
      );

      if (isUserType?.role === "doctor") {
        const result = await bookingsCollection
          .find({ email, isBooked: true })
          .toArray();
        return res.send({
          status: httpStatus.OK,
          message: "Successfully Find the My Booking ",
          data: result,
        });
      } else if (isUserType?.role === "admin") {
        const result = await bookingsCollection.find({}).toArray();
        return res.send({
          status: httpStatus.OK,
          message: "Successfully Find the My Booking ",
          data: result,
        });
      } else {
        const result = await bookingsCollection
          .find({ patientEmail: email, isBooked: true })
          .toArray();
        return res.send({
          status: httpStatus.OK,
          message: "Successfully Find the My Booking ",
          data: result,
        });
      }
    });

    app.get(
      "/api/v1/prescription_doctor_history/:id",
      verifyJWT,
      verifyDoctor,
      async (req, res) => {
        const { id } = req.params;
        const email = req.decoded.email;

        const isDoctorsId = await bookingsCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { patientEmail: 1 } }
        );

        const patientInformation = await patientCollection.findOne({
          email: isDoctorsId?.patientEmail,
        });
        if (!patientInformation) {
          throw new Error("Something Went Wrong");
        }
        const doctorInformation = await doctorsCollection.findOne(
          { email },
          {
            projection: {
              password: 0,
              email: 0,
              registeredDoctor: 0,
            },
          }
        );
        if (!doctorInformation) {
          throw new Error("Something went wrong");
        }
        res.send({
          status: httpStatus.OK,
          message: "Successfully Get",
          data: {
            patientInformation,
            doctorInformation,
          },
        });
      }
    );

    app.post(
      "/api/v1/doctorprescription",
      verifyJWT,
      verifyDoctor,
      async (req, res) => {
        const email = req.decoded.email;
        const createAt = new Date();
        const data = req.body;
        data.bookingId = new ObjectId(data.bookingId);

        // started transaction roll back
        const session = client.startSession();
        try {
          session.startTransaction();

          const prescription = await prescriptionCollection.insertOne(
            {
              ...data,
              email,
              createAt,
            },
            { session }
          );
          if (!prescription) {
            throw new Error("Prescription Session Issues");
          }

          const filter = {
            _id: data.bookingId,
          };

          const updateDoc = {
            $set: {
              prescription: true,
            },
          };
          const updateBooking = await bookingsCollection.updateOne(
            filter,
            updateDoc,
            { upsert: true, session }
          );
          if (!updateBooking) {
            throw new Error("Booking Session Issues");
          }
          await session.commitTransaction();
          await session.endSession();
          return res.send({
            status: httpStatus.CREATED,
            message: "Successfully  Prescription Recorded ",
            data: prescription,
          });
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }
    );

    app.get(
      "/api/v1/find_the_prescription",
      verifyJWT,

      async (req, res) => {
        const email = req.decoded.email;

        const isExistType = await usersCollection.findOne(
          { email },
          {
            projection: {
              role: 1,
            },
          }
        );
        if (isExistType.role === "user") {
          const result = await prescriptionCollection
            .find({
              patientemail: email,
            })
            .sort({ createAt: -1 })
            .toArray();
          return res.send({
            status: httpStatus.OK,
            message: "Successfully Get The My Prescription",
            data: result,
          });
        } else {
          const result = await prescriptionCollection
            .find({
              email,
            })
            .sort({ createAt: -1 })
            .toArray();
          return res.send({
            status: httpStatus.OK,
            message: "Successfully Get The My Prescription",
            data: result,
          });
        }
      }
    );

    app.post("/api/v1/review", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const data = req.body;
      data.doctorId = new ObjectId(data.doctorId);
      data.appointmentId = new ObjectId(data.appointmentId);
      data.createAt = new Date();
      const filter = {
        _id: data.doctorId,
      };

      const isExistReview = await reviewCollection.findOne({
        appointmentId: data.appointmentId,
      });

      if (isExistReview) {
        return res.send({
          status: httpStatus.OK,
          message: "This Doctor Review All Ready Exist",
        });
      }
      const isDoctorExist = await doctorsCollection.findOne(filter, {
        projection: {
          email: 1,
        },
      });
      post_data(reviewCollection, {
        ...data,
        email,
        doctoremail: isDoctorExist?.email,
      })
        .then((result) => {
          return res.send({
            status: httpStatus.CREATED,
            message: "Review Recorded Successfully",
            data: result,
          });
        })
        .catch((error) => {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        });
    });

    app.get("/api/v1/all_my_review", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const isUserTypes = await usersCollection.findOne(
        { email },
        { projection: { role: 1 } }
      );

      switch (isUserTypes.role) {
        case "user":
          {
            const reviews = await reviewCollection.find({ email }).toArray();
            res.send({
              status: httpStatus.CREATED,
              message: "Successfuly Get My Review",
              data: reviews,
            });
          }
          break;
        case "doctor":
          {
            const averageRatingResult = await reviewCollection
              .aggregate([
                { $match: { doctoremail: email } },
                {
                  $group: {
                    _id: "$doctoremail",
                    averageRating: { $avg: "$rating" },
                  },
                },
              ])
              .toArray();
            const reviews = await reviewCollection
              .find({ doctoremail: email })
              .toArray();

            res.send({
              status: httpStatus.CREATED,
              message: "Successfuly Get My Review",
              data: reviews,
              avg: averageRatingResult,
            });
          }
          break;
        case "admin":
          {
            const reviews = await reviewCollection.find({}).toArray();
            const avgRatings = await reviewCollection
              .aggregate([
                {
                  $group: {
                    _id: "$doctoremail",
                    averageRating: { $avg: "$rating" },
                  },
                },
              ])
              .toArray();
            res.send({
              status: httpStatus.OK,
              message: "Successfuly Get My Review",
              data: reviews,
              avg: avgRatings,
            });
          }
          break;
        default: {
          console.log("defaulT");
        }
      }
    });

    app.delete("/api/v1/delete_review/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      delete_data(id, reviewCollection)
        .then((result) => {
          return res.send({
            status: httpStatus.OK,
            message: "Successfully Delete Review",
            data: result,
          });
        })
        .catch((error) => {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        });
    });
    app.get("/api/v1/my_profile_information", verifyJWT, async (req, res) => {
      const email = req.decoded.email;

      const result = await patientCollection.findOne(
        { email },
        {
          projection: {
            image: 1,
            contactNumber: 1,

            address: 1,
          },
        }
      );
      res.send({
        status: httpStatus.OK,
        message: "Successfully Get My Profile",
        data: result,
      });
    });

    app.put("/api/v1/updateUserProfile/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const filter = {
        _id: new ObjectId(id),
      };
      const updateDoc = {
        $set: {
          address: data?.address,
          contactNumber: data?.contactNumber,
          image: data?.image,
        },
      };
      update_data(filter, updateDoc, patientCollection)
        .then((result) => {
          return res.send({
            status: httpStatus.OK,
            message: "Successfully Update Profile",
            data: result,
          });
        })
        .catch((error) => {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        });
    });

    app.get("/api/v1/common_dashboard", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const isUserRole = await usersCollection.findOne(
        { email },
        { projection: { role: 1 } }
      );
      switch (isUserRole?.role) {
        case "user":
          {
            const totalReviewCount = await reviewCollection.countDocuments({
              email,
            });
            const totalPrescription =
              await prescriptionCollection.countDocuments({
                patientemail: email,
              });
            const totalPaymentInfo = await paymentsCollection
              .find(
                {
                  patientEmail: email,
                },
                {
                  projection: {
                    _id: 1,
                    price: 1,
                    slot: 1,
                    treatment: 1,
                  },
                }
              )

              .toArray();
            res.send({
              status: httpStatus.OK,
              message: "Successfuy Get Patient Dashboard",
              data: {
                commonone: totalReviewCount,
                commontwo: totalPrescription,
                commonthree: totalPaymentInfo,
              },
            });
          }
          break;
        case "doctor":
          {
            const totalReviewCount = await reviewCollection.countDocuments({
              doctoremail: email,
            });

            const totalPrescription =
              await prescriptionCollection.countDocuments({
                email,
              });

            const totalPaymentInfo = await paymentsCollection
              .find(
                {
                  email,
                },
                {
                  projection: {
                    _id: 1,
                    price: 1,
                    slot: 1,
                    treatment: 1,
                  },
                }
              )

              .toArray();
            res.send({
              status: httpStatus.OK,
              message: "Successfuy Get Patient Dashboard",
              data: {
                commonone: totalReviewCount,
                commontwo: totalPrescription,
                commonthree: totalPaymentInfo,
              },
            });
          }
          break;
        case "admin":
          {
            const totalUserCount =
              await usersCollection.estimatedDocumentCount();
            const totalReviewCount =
              await reviewCollection.estimatedDocumentCount();
            const totalPrescriptionCount =
              await prescriptionCollection.estimatedDocumentCount();
            const totalPatientCount =
              await patientCollection.estimatedDocumentCount();
            const totalDoctorCount =
              await doctorsCollection.estimatedDocumentCount();
            const totalBookingCount =
              await bookingsCollection.estimatedDocumentCount();
            const totalAvailableCount =
              await appointmentOptionCollection.estimatedDocumentCount();
            const totalPaymentInfo = await paymentsCollection
              .find(
                {},
                {
                  projection: {
                    _id: 1,
                    price: 1,
                    slot: 1,
                    treatment: 1,
                  },
                }
              )

              .toArray();

            res.send({
              status: httpStatus.OK,
              message: "Successfuy Get Patient Dashboard",
              data: {
                commonone: totalReviewCount,
                commontwo: totalPrescriptionCount,
                commonthree: totalPaymentInfo,
                commonfour: totalPatientCount,
                commonfive: totalUserCount,
                commonsix: totalBookingCount,
                commonseven: totalAvailableCount,
                commoneight: totalDoctorCount,
              },
            });
          }
          break;

        default: {
          console.log("default information");
        }
      }
    });

    app.get(
      "/api/v1/payment_transaction_report",
      verifyJWT,
      async (req, res) => {
        const result = await paymentsCollection.find({}).toArray();

        res.send({
          status: httpStatus.OK,
          message: "Successfully Get All Paymeny Report",
          data: result,
        });
      }
    );
    app.get("/api/v1/update_patient_profile/:id", async (req, res) => {
      const { id } = req.params;
      const result = await patientCollection.findOne({ _id: new ObjectId(id) });
      res.send({
        status: httpStatus.OK,
        message: "Successfully Get My Profile",
        data: result,
      });
    });
    app.put(
      "/api/v1/update_patient_profile_info/:id",
      verifyJWT,
      async (req, res) => {
        const { id } = req.params;
        const data = req.body;
        Reflect.deleteProperty(data, "_id");

        const filter = {
          _id: new ObjectId(id),
        };
        const updateDoc = {
          $set: {
            ...data,
          },
        };
        update_data(filter, updateDoc, patientCollection)
          .then((result) => {
            return res.send({
              status: httpStatus.OK,
              message: "Successfully Update Patient Profile",
              data: result,
            });
          })
          .catch((error) => {
            return res.send({
              status: httpStatus.NOT_FOUND,
              message: error?.message,
            });
          });
      }
    );

    app.get("/patient/OnSitebookingSloat", verifyJWT, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "onsitebookings", // the collection to join
            localField: "_id", // field from doctorCollection
            foreignField: "doctorId", // field from bookingCollection
            as: "onsitebookings", // output array field
          },
        },

        {
          $project: {
            name: 1,

            specialty: 1,
            experience: 1,
            appointmentfee: 1,
            image: 1,
            district: 1,
            onsitebookings: {
              appointmentDate: 1,
              treatment: 1,
              patient: 1,
              slot: 1,
              price: 1,
              status: 1,
              doctorId: 1,
              createdAt: 1,
              isBooked: 1,

              _id: 1,
            },
          },
        },
      ];
      const mergedData = await doctorsCollection.aggregate(pipeline).toArray();
      res.send(mergedData);
    });

    app.put("/api/v1/isOnsiteBookingSloat/:id", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const { id } = req.params;
      const data = req.body;

      // checked is it patients Account
      const isPatient = await usersCollection.findOne(
        { email },
        { projection: { role: 1 } }
      );

      if (
        isPatient.role === process.env.USER_ROLE &&
        isPatient.role === process.env.USER_ROLE_ADMIN
      ) {
        return res.send({
          status: httpStatus.UNAUTHORIZED,
          message: "Only Patient Can Be Booking",
        });
      }

      const filter = {
        _id: new ObjectId(id),
      };
      const updateDoc = {
        $set: {
          isBooked: data.isBooked,
          patientEmail: email,
          bookingTime: new Date(),
        },
      };

      update_data(filter, updateDoc, onsiteBookingCollection)
        .then((result) => {
          return res.send({
            status: httpStatus.OK,
            message: "Booking Successfull",
            data: result,
          });
        })
        .catch((error) => {
          return res.send({
            status: httpStatus.NOT_FOUND,
            message: error?.message,
          });
        });
    });

    app.get("/Onsitebookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      // console.log(email);
      // console.log(decodedEmail);

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      //isBooked: true
      const query = { email };
      const bookings = await onsiteBookingCollection.find(query).toArray();

      res.send({
        status: httpStatus.OK,
        message: "Successfully Get the Data",
        data: bookings,
      });
    });
    app.get("/api/v1/myonsite_appointment", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      try {
        const result = await onsiteBookingCollection
          .find({ patientEmail: email, isBooked: true })
          .toArray();
        res.send({
          status: httpStatus.OK,
          message: "Successfully Get the Data",
          data: result,
        });
      } catch (error) {
        res.send({
          status: httpStatus.NOT_FOUND,
          message: error?.message,
        });
      }
    });

    app.delete(`/api/v1/deleteAccount`, verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      try {
        const result = await usersCollection.deleteOne({ email });
        res.send({
          success: true,
          status: httpStatus.OK,
          message: "Successfully Delete Account",
          data: result,
        });
      } catch (error) {
        res.send({
          status: httpStatus.FORBIDDEN,
          message: error?.message,
        });
      }
    });
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
