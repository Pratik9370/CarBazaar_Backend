const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    name:{
        type: String,
        required:true
    },
    mobile:{
        type: String,
        required:true
    },
    SavedCars:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'car'
    }],
    RegisteredCars: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'car'
    }]
})

const User = mongoose.model('user',userSchema)

module.exports = User