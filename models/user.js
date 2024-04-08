const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name :{
        type: String,
        required: true
    },
    email:{
        type:String,  
        unique :true ,  //email should be unique for every user
        required: true
    },
    password:{
        type: String,
        required: true
    }
});

const User = mongoose.model('User',userSchema);
module.exports = User;

