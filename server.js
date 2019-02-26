const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')
const mongoose = require('mongoose')
//mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
var connection = mongoose.createConnection(process.env.MONGO_URI, {useNewUrlParser: true});

var db = connection
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  // we're connected!
  console.log('database connection: Successful!')
});
//schemas!
var schema = mongoose.Schema

var exerciseSchema = new schema({
  description: {type: String, required:[true]},
  duration: {type: Number, required:[true]},
  date: Date
})

var userInfoSchema = new schema({
  username : String,
  _id: {type: String, required:[true]},
  exercise: [exerciseSchema],
  count: Number
})
var Userinfo =  connection.model('Userinfo', userInfoSchema)
var Exerciseinfo = connection.model('Exerciseinfo',exerciseSchema)

//Logger
app.use(function(req, res, next){
console.log(req.method +' '+ req.path  + ' - ' + req.ip)
next()
})
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
//ADD NEW USERNAMES (IF AVAILABLE) AND GIVE THEM IDS
app.post('/api/exercise/new-user',(req,res)=>{
  var username = req.body.username
  var user = new Userinfo({username: username, _id:shortid.generate()})
  Userinfo.find({username: username}, (err, doc)=>{
    console.log(doc[0])
    err?console.log(err+' @username lookup'):null
    doc[0]!==undefined?res.send("Sorry, but that username is already taken.  Create another!")
    :user.save((err, user)=>{
      err?console.log(err+" @save to the database"):null
      res.json({username:user.username, _id:user._id})
    })
  })
  });

//DISPLAY ALL THE USERS - only username and id
app.get('/api/exercise/users',(req, res)=>{
  Userinfo.find(null,'username _id', (err, docs)=>{
    err?console.log(err+" @Displaying all users"):null
    res.send(docs)
  })
});

//ADD EXERCISES TO THE USERS
app.post('/api/exercise/add', (req, res)=>{
  
  var user_id = req.body.userId,
      description = req.body.description,
      duration = req.body.duration,
      date = req.body.date
  date===''?
    date = new Date(Date.now()):
  date.match(/-/)?
    date = new Date(date):
  date = new Date(parseInt(date, 10));
  var  exercise = ({description:description, duration:duration, date:date.toDateString()})

  Userinfo.findById(user_id, (err, user)=>{
    err?console.log(err + " @Find user to add exercises"):null
    user===null?req.body.userId="Check the userId you entered.  There is no match for that in the database":user.exercise.push(exercise)
    console.log(exercise)
    user.exercise.sort((a,b)=>{
      return b.date-a.date
    })  
    user.markModified('exercise.date');
    user.save(()=>{
    err?console.log(err+" @saving updated user"):null
      
    })
    res.json({username:user.username,_id:user_id, description:description, duration:duration+" minutes", date:date.toDateString()})    
  })
});

//EXERCISE LOG 
app.get('/api/exercise/log/:_id', (req, res)=>{
var user_id = req.params._id
Userinfo.findById(user_id,'-__v -exercise._id', (err, user)=>{
err?console.log(err+" @finding user for exercise log"):null
  console.log("exercise count = "+user.exercise.length)
  user.count=user.exercise.length
  res.send(user)
})
});
// /log?userId=<_id>&from=<date>&to=<date>&limit=<number>
app.get('/api/exercise/log',(req, res, next)=>{
  //res.send(req.query);
  req.query.from===undefined?req.query.from="1900-01-01":req.query.from;
  req.query.to===undefined?req.query.to=Date.now():req.query.to;
  req.query.from = new Date(req.query.from);
  req.query.limit!==undefined?req.query.limit=parseInt(req.query.limit,10):req.query.limit=100;
  req.query.to = new Date(req.query.to);
  Userinfo.aggregate([
    {$match: {_id: req.query.userId}},
    {$project:{"exercise._id":0}},
    {
      $project:{
        username: "$username",
        exercise:{
          "$slice":[{
          "$filter": {
            input: "$exercise",
            as: "exercise",
            cond: {
              $and: [
                { $gte: [ "$$exercise.date", req.query.from ] },
                { $lte: [ "$$exercise.date", req.query.to ] }
              ]
            }
          }
        }, req.query.limit]
      }
     }
    }
  ]).exec((err, doc)=>{
    err?console.log(err+" @aggregate"):null
    console.log(doc[0].exercise.length+ " exercise(s) in the log")
    
    res.json({
    username:doc[0].username,
    _id:doc[0]._id,
    count:doc[0].exercise.length,
    log:doc[0].exercise
    })

    //res.send(doc[0])
    })
});

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
