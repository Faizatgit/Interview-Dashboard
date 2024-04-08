// index.js

const http = require('http');
const express = require('express');
const { Server: SocketIO } = require('socket.io');
const bCrypt = require('bcrypt');
const path = require('path');
const User = require('./models/user.js');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');


const app = express();
const server = http.createServer(app);

const io = new SocketIO(server);
const PORT = 3000;

// Create a users map to keep track of users

mongoose.connect('mongodb://127.0.0.1:27017/dummy' , { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connection successful!'))
.catch(err => console.error('Error connecting to the database!',err));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.set('view engine' , 'ejs');
app.set('views' , path.join(__dirname,'views'));
app.use(express.static(path.join(__dirname, 'public')));

//Routes

app.get('/signup' , (req,res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      // Check if all fields are filled
      if (!name || !email || !password) {
        return res.status(400).send('All fields are required');
      }
  
      // Check if the user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).send('User with this email already exists');
      }
  
      // Hash the password
      const hashedPassword = await bCrypt.hash(password, 10);
  
      // Create a new user and save it to the database
      const newUser = new User({ name, email, password: hashedPassword });
      await newUser.save();
  
      // res.status(201).send('User created successfully');
      
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred while creating the user');
    }
    res.redirect('/login');
  });

  app.get('/login',(req,res) => {
    res.render('login');
});
app.post('/login', async (req,res) => {
    const {email, password}= req.body;
    const user = await User.findOne({email});
    if(!user){
        return res.status(500).send("Email doesnot exists!");
    }
    try{
        if( await bCrypt.compare(password,user.password))
        {
            // res.status(200).send('Successfully Loged in!');
            console.log("Login successful");
        }
        else{
            res.status(401).send("Incorrect Password");
        }
    }
    catch(err){
        console.err(err);
        res.status(500).send('Error loging in!');
    }
    res.redirect('/interview');

});
const users = new Map();

io.on('connection', socket => {
    console.log(`user connected: ${socket.id}`);
    users.set(socket.id, socket.id);

    // emit that a new user has joined as soon as someone joins
    socket.broadcast.emit('users:joined', socket.id);
    socket.emit('hello', { id: socket.id });

    socket.on('outgoing:call', data => {
        const { fromOffer, to } = data;

        socket.to(to).emit('incomming:call', { from: socket.id, offer: fromOffer });
    });

    socket.on('call:accepted', data => {
        const { answere, to } = data;
        socket.to(to).emit('incomming:answere', { from: socket.id, offer: answere })
    });


    socket.on('disconnect', () => {
        console.log(`user disconnected: ${socket.id}`);
        users.delete(socket.id);
        socket.broadcast.emit('user:disconnect', socket.id);
    });
});


app.use(express.static( path.resolve('./public') ));

app.get('/interview',(req,res)=>{
    res.sendFile(path.join(__dirname, 'public', 'index.html'));

})

app.get('/users', async(req, res) => {
    return res.json(Array.from(users));
    // try {
    //     const users = await User.find();
    //     res.json(users);
    // } catch (error) {
    //     console.error(error);
    //     res.status(500).send('Error fetching users');
    // }
});

server.listen(PORT, () => console.log(`Server started at PORT:${PORT}`));
