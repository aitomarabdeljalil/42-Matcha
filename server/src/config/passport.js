const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Register Google OAuth strategy only when credentials are available.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findByGoogleId(profile.id);
      if (!user) {
        user = await User.createOAuth({
          googleId: profile.id,
          email: profile.emails[0].value,
          username: profile.displayName,
          first_name: profile.name.givenName,
          last_name: profile.name.familyName,
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else if (process.env.NODE_ENV === 'test') {
  // In tests without real Google creds, register a dummy strategy to avoid init errors
  passport.use('google', new GoogleStrategy({
    clientID: 'dummy-client-id',
    clientSecret: 'dummy-client-secret',
    callbackURL: '/api/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => done(null, { id: 1 })));
}

module.exports = passport;
