const nodemailer = require("nodemailer");

const sendEmail = async (email, email_body, subject) => {
  //console.log(email);
  await nodemailer.createTestAccount();
  // let testAccount =
  // console.log(testAccount);

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER_EMAIL, // generated ethereal user
      pass: process.env.SMTP_PASSWORD, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.SMTP_USER_EMAIL, // sender address
    to: `${email}`, // list of receivers email
    subject: subject, // Subject line
    text: email_body, // plain text body
    html: `<b>${email_body}</b>`, // html body
  });
  return info;
};

module.exports = {
  sendEmail,
};
