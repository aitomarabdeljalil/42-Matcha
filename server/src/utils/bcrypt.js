const bcrypt = require('bcryptjs');

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

const hashPassword = async (password) => {
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

module.exports = {
  hashPassword,
  comparePassword
};