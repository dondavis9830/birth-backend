const mongoose=require('mongoose')

const accessSchema=mongoose.Schema({
    password:String
})

module.exports=mongoose.model('access',accessSchema)