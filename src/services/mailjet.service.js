const Mailjet = require('node-mailjet');

// con esto voy a iniciar mi servicio de mail y claramente los valores de esto lo vamos a tener que cargar en el dotenv
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

const sendEmail = async (expenseTitle) => {
  try {
    const response = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: "mauronacimento777@gmail.com",
            Name: "Mauro 1 Nacimento",
          },
          To: [
            {
              Email: "nacirox@gmail.com",
              Name: "Mauro 2 Nacimento",
            },
          ],
          Subject: "Nuevo Gasto Creadao - " + expenseTitle,
          TextPart: "Tienes un nuevo Gasto en tu lista de gastos",
          HTMLPart: "Tienes un nuevo Gasto en tu lista de gastos",
        },
      ],
    });
    return response;
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = sendEmail;