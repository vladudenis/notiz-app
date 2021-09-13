const express = require('express');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require("bcrypt");
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

//express app
const app = express();

//models
const User = require('./models/db.js').User;
const Note = require('./models/db.js').Note;

//view engine
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

//express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// cookie parser and session
app.use(cookieParser());
app.use(session({
    secret: 'verygoodsecret',
    resave: false,
    saveUninitialized: true
}));

//i18next
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
           fallbackLng: 'de',
           preload: ['en', 'de'],
           backend: {
              loadPath: './locales/{{lng}}/translation.json'
           }
        });
app.use(middleware.handle(i18next));

//passport
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function(user, done){
   done(null, user.id);
});
passport.deserializeUser(function(id, done){
   User.findById(id, function(err, user){
      done(err, user);
   });
});

//passport strategies
passport.use('local-signup', new LocalStrategy(async function(username, password, done){
   await User.findOne({ username: username }, async function (err, user) {
      if(err) return done(err);
      if(user) return done(null, false, { message: 'Benutzer ist bereits registriert.' });

      const salt = await bcrypt.genSalt(10);

      const newUser = new User({
         username: username,
         password: await bcrypt.hash(password, salt),
      });

      await newUser.save(function(err){
         if(err) return console.log(err);
         console.log('Created new user.')
      })

      return done(null, newUser);

   }).catch(function(err){
      console.log(err);
   });
}));

passport.use('local-login', new LocalStrategy(function(username, password, done) {
   User.findOne({ username: username }, function (err, user) {
      if(err) return done(err);
      if(!user) return done(null, false, { message: 'Benutzer existiert nicht.' });

      const pwIsValid = bcrypt.compare(password, user.password);

      if(pwIsValid) {
         console.log('User logged in.')
         return done(null, user);
      }else{
         console.log('Invalid password.')
         return done(null, false, { message: 'Passwort ist falsch.' });
      }
   }).catch(function(err){
      console.log(err);
   });
}));

//authentication checker
function isLoggedIn(req, res, next){
   if(req.isAuthenticated()) {
      return next();
   }
   res.redirect('/login');
}

//routes
//GET request handlers
app.get('/signup', function(req, res){
   return res.render('signup',
       {
          signuptitle: req.i18n.t('signup-title'),
          signup: req.i18n.t("signup-button"),
          login: req.i18n.t("login-button")
       }
   );
});

app.get('/signup-fail', function(req, res){
   return res.render('signup',
       {
          message: req.i18n.t('signup-fail'),
          signuptitle: req.i18n.t('signup-title'),
          signup: req.i18n.t("signup-button"),
          login: req.i18n.t("login-button")
       });
});

app.get('/login', function(req, res){
   if(req.isAuthenticated()){
      req.logout();
      console.log('User logged out.')
   }
   return res.render('login',
       {
          logintitle: req.i18n.t('login-title'),
          login: req.i18n.t("login-button"),
           username: req.i18n.t('username-placeholder'),
           password: req.i18n.t('password-placeholder'),
          signup: req.i18n.t("signup-button")
       }
   );
});

app.get('/login-fail', function(req, res){
   return res.render('login',
       {
          message: req.i18n.t('login-fail'),
          logintitle: req.i18n.t('login-title'),
          login: req.i18n.t("login-button"),
          signup: req.i18n.t("signup-button")
       });
});

app.get('/logout', isLoggedIn, function(req, res){
   req.logout();
   console.log('User logged out.');
   return res.redirect('/login');
});

app.get('/', isLoggedIn, function(req, res) {
   try{
      const username = req.user.username;
      Note.find({ author: username }, function(err, notes){
         if(err) return done(err);
         if(notes){
            return res.render('home',
                {
                   notes: notes,
                    user: req.user.username,
                   title: req.i18n.t('app-title'),
                   logout: req.i18n.t('logout-button'),
                   placeholdertitle: req.i18n.t('placeholder-title'),
                   placeholdernote: req.i18n.t('placeholder-note'),
                   add: req.i18n.t('add-note-button'),
                   deleteall: req.i18n.t('delete-all-button'),
                   newnote: req.i18n.t('new-note')
                });
         }
      }).lean();
   }catch(err){
      console.log(err);
      res.status(500).send('Error 500: Es gibt ein Problem mit unseren Servern.');
   }
});

app.get('/lng/:lang', function(req, res){
    const lang = req.params.lang.toString();
    console.log('Switched language to ' + lang);
    res.cookie('i18next', lang, { maxAge: 10000000, path: '/', secure: true });
    res.redirect('/');
});


//POST request handlers
app.post('/signup', passport.authenticate('local-signup',
    { successRedirect: '/login', failureRedirect: '/signup-fail' })
);

app.post('/login', passport.authenticate('local-login',
    { successRedirect: '/', failureRedirect: '/login-fail' })
);

app.post('/', isLoggedIn, async function(req, res, next) {
   await Note.findOne({title: req.body.title, author: req.user.username}, async function (err, note) {
      if (err) return console.log(err);
      if (note) return res.render('home',
          {
             message: req.i18n.t('note-exists'),
             title: req.i18n.t('app-title'),
             logout: req.i18n.t('logout-button'),
             placeholdertitle: req.i18n.t('placeholder-title'),
             placeholdernote: req.i18n.t('placeholder-note'),
             add: req.i18n.t('add-note-button'),
             delete: req.i18n.t('delete-note-button'),
             deleteall: req.i18n.t('delete-all-button'),
             newnote: req.i18n.t('new-note'),
          });

      if(req.body.title.length > 30){
         return res.render('home',
             {
                message: req.i18n.t('title-bounds'),
                title: req.i18n.t('app-title'),
                logout: req.i18n.t('logout-button'),
                placeholdertitle: req.i18n.t('placeholder-title'),
                placeholdernote: req.i18n.t('placeholder-note'),
                add: req.i18n.t('add-note-button'),
                delete: req.i18n.t('delete-note-button'),
                deleteall: req.i18n.t('delete-all-button'),
                newnote: req.i18n.t('new-note')
             });
      }

      if(req.body.body.length > 500){
         return res.render('home',
             {
                message: req.i18n.t('note-bounds'),
                title: req.i18n.t('app-title'),
                logout: req.i18n.t('logout-button'),
                placeholdertitle: req.i18n.t('placeholder-title'),
                placeholdernote: req.i18n.t('placeholder-note'),
                add: req.i18n.t('add-note-button'),
                delete: req.i18n.t('delete-note-button'),
                deleteall: req.i18n.t('delete-all-button'),
                newnote: req.i18n.t('new-note')
             });
      }

      const newNote = new Note({
         title: req.body.title,
         body: req.body.body,
         author: req.user.username
      });

      try{
         await newNote.save(function (err) {
            if (err) return console.log(err);
            console.log('Created new note.')
            return res.redirect('/');
         });
      }catch(err){
         console.log(err);
         res.status(500).send('Error 500: Es gibt ein Problem mit unseren Servern.');
      };
   });
});


//DELETE request handlers
app.post("/delete/:id", isLoggedIn, async function(req, res){
   console.log('Received DELETE request.');
   try{
      await Note.deleteOne({ _id: req.params.id }).then(function(){
         console.log('Deleted note.');
         return res.redirect('/');
      });
   }catch(err){
      console.log(err);
      res.status(500).send('Error 500: Es gibt ein Problem mit unseren Servern.');
   }
});

app.post("/delete_all", isLoggedIn, async function(req, res){
   console.log('Received DELETE ALL request.');
   try{
      await Note.deleteMany({ author: req.user.username }).then(function(){
         console.log('Deleted all notes.');
         return res.redirect('/');
      });
   }catch(err){
      console.log(err);
      res.status(500).send('Error 500: Es gibt ein Problem mit unseren Servern.');
   }
});

//port listener
app.listen(3000, () => console.log("App listening at http://localhost:3000"));

module.exports = app;