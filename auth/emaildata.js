const createDoctorContent = (emailcontent) => {
  return {
    email_body: `
    <h3>Congratulations Successfully Create Your Account</h3>
    <div>
        <p>Your Email Address: ${emailcontent.email}</p>
        <p>Your Password ${emailcontent.password}</p>
        <p>Thanks from Care Pulse .</p>
    </div>
    `,
    subject: "Successfully Create Your Doctor Account ",
  };
};

module.exports = {
  createDoctorContent,
};
