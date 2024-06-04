const http = require('http');
const express = require('express');
const { Server: SocketIO } = require('socket.io');
const bCrypt = require('bcrypt');
const path = require('path');
const User = require('./models/user.js');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);
const PORT = 3000;

const users = new Map();
let lifeline50 = 1;
let lifelineSkip = 1;
const multer = require('multer');


function calculatePrize(answers) {
  // Implement prize calculation logic here
  return 1000;
}

mongoose.connect('mongodb://127.0.0.1:27017/dummy', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connection successful!'))
  .catch(err => console.error('Error connecting to the database!', err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'my_secret_key',
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.redirect('/login');
  }
}

app.get('/', (req, res) => {
  console.log('Root route accessed, redirecting to /login');
  res.redirect('/login');
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/homepage', requireLogin, async (req, res) => {
  res.render('homepage');
});

app.get('/quiz_homepage', requireLogin, async (req, res) => {
  res.render('quiz_homepage');
});


app.get('/help', (req, res) => {
  res.render('help');
});

app.get('/rules', (req, res) => {
  res.render('rules');
});

app.get('/quiz', requireLogin, (req, res) => {
  const questions = JSON.parse(fs.readFileSync('./data/Quiz.json', 'utf-8'));
  res.render('quiz', { questions, lifeline50, lifelineSkip });
});

app.post('/quiz', (req, res) => {
  // Assuming req.body contains the user's quiz answers
  const quizData = JSON.parse(fs.readFileSync('./data/Quiz.json', 'utf-8'));
  const totalQuestions = quizData.length;
  let correctAnswers = 0;
  let correctOptions = [];
  
  quizData.forEach((question, index) => {
    const selectedOption = req.body[`question${index}`];
    if (selectedOption && selectedOption === question.right) {
      correctAnswers++;
      correctOptions.push(selectedOption);
    }
  });
  
  const prize = calculatePrize(correctAnswers);
  
  req.session.prize = prize;
  
  res.render('result', { totalQuestions, correctAnswers, correctOptions, prize }); // Pass it to the template
});

 // Define the calculatePrize function
function calculatePrize(correctAnswers) {
  // Your logic to calculate the prize based on the number of correct answers
  // For example, assuming each correct answer earns 100 points
  const pointsPerCorrectAnswer = 100;
  return correctAnswers * pointsPerCorrectAnswer;
}


app.get('/profile', requireLogin, (req, res) => {
  res.render('profile');
});

app.post('/profile', requireLogin, async (req, res) => {
  const { fullName, gender, dateOfBirth, address, qualifications } = req.body;
  const userId = req.session.user._id; // Assuming you store user ID in session
  try {
    // Update the user's profile information in the database
    await User.findByIdAndUpdate(userId, {
      fullName,
      gender,
      dateOfBirth,
      address,
      qualifications
    });
    res.redirect('/homepage'); // Redirect to homepage after updating profile
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating profile');
  }
});


app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).send('All fields are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send('User with this email already exists');
    }

    const hashedPassword = await bCrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while creating the user');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(500).send("Email does not exist!");
  }
  try {
    if (await bCrypt.compare(password, user.password)) {
      req.session.user = user;
      console.log("Login successful");
      res.redirect('/homepage');
    } else {
      res.status(401).send("Incorrect Password");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in!');
  }
});

io.on('connection', socket => {
  console.log(`User connected: ${socket.id}`);
  users.set(socket.id, socket.id);

  socket.broadcast.emit('users:joined', socket.id);
  socket.emit('hello', { id: socket.id });

  socket.on('outgoing:call', data => {
    const { fromOffer, to } = data;
    socket.to(to).emit('incoming:call', { from: socket.id, offer: fromOffer });
  });

  socket.on('call:accepted', data => {
    const { answer, to } = data;
    socket.to(to).emit('incoming:answer', { from: socket.id, offer: answer });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    socket.broadcast.emit('user:disconnect', socket.id);
  });
});

app.get('/interview', requireLogin, async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/users', async (req, res) => {
  return res.json(Array.from(users));
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error logging out');
    }
    res.redirect('/login');
  });
});

server.listen(PORT, () => console.log(`Server started at PORT:${PORT}`));
