const validator = require('validator');

const validateRegister = (req, res, next) => {
  const { email, password, first_name, last_name, birth_date, gender, preferred_gender } = req.body;

  // Required fields
  if (!email || !password || !first_name || !last_name || !birth_date || !gender || !preferred_gender) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Email validation
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Name validation
  if (first_name.length < 2 || last_name.length < 2) {
    return res.status(400).json({ error: 'First and last name must be at least 2 characters long' });
  }

  // Age validation (18+)
  const birthDate = new Date(birth_date);
  const age = new Date().getFullYear() - birthDate.getFullYear();
  if (age < 18) {
    return res.status(400).json({ error: 'You must be at least 18 years old' });
  }

  // Gender validation
  const validGenders = ['male', 'female', 'other'];
  if (!validGenders.includes(gender) || !validGenders.includes(preferred_gender)) {
    return res.status(400).json({ error: 'Invalid gender selection' });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin
};