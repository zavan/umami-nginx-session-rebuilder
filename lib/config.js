import 'dotenv/config';

const databaseURL = process.env.DATABASE_URL;
const appSecret = process.env.APP_SECRET || databaseURL;
const savedIp = process.env.SAVED_IP || "::ffff:127.0.0.1";

export {
  databaseURL,
  appSecret,
  savedIp
};
