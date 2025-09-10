import passport from "passport";
export { passport };

// When a user succesfully signs in:
passport.serializeUser((user, done) => {
  done(null, user);
});

// When a user logs out:
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Github

export const loginWithGithub = passport.authenticate(`github`, {
  scope: [`user:email`],
});

export const handleGithubCallback = passport.authenticate(`github`, {
  failureRedirect: `/auth/github/error`,
});

// Google

export const loginWithGoogle = passport.authenticate(`google`, {
  scope: [`profile`],
});

export const handleGoogleCallback = passport.authenticate(`google`, {
  failureRedirect: `/auth/google/error`,
});

// Mastodon

export const loginWithMastodon = passport.authenticate(`mastodon`, {
  scope: [`profile`],
});

export const handleMastodonCallback = passport.authenticate(`mastodon`, {
  failureRedirect: `/auth/mastodon/error`,
});

/**
 * ...docs go here...
 */
export const logout = (req, res, next) => {
  const { user } = req.session.passport ?? {};
  if (!user) return res.redirect(`/`);
  req.logout((err) => {
    if (err) {
      console.log(`error logging ${user.displayName} out`);
      return next(err);
    }
    console.log(`${user.displayName} logged out`);
    res.redirect(`/`);
  });
};
