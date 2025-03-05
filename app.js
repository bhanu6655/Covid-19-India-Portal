const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const InitailizeDb = async () => {
  try {
    db = await open({filename: dbpath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server running on http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB error ${e.message}`)
    process.exit(1)
  }
}

InitailizeDb()

const handler = async (request, response, next) => {
  let jwttoke
  const header = request.headers['authorization']
  if (header !== undefined) {
    jwttoke = header.split(' ')[1]
  }
  if (jwttoke === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwttoke, 'secretkey', async (err, payload) => {
      if (err) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

const stateobjecttodbresponse = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictObjectoresponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtNmae: dbObject.district_name,
    stateId: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.post(`/login/`, async (request, response) => {
  const {username, password} = request.body
  try {
    const getuser = `select * from user where username = '${username}'`
    const user = await db.get(getuser)
    if (user === undefined) {
      response.status(400)
      response.send('Invalid user')
    } else {
      isPasswordMathced = await bcrypt.compare(password, user.password)
      if (isPasswordMathced === true) {
        const payload = {username: username}
        const jwtToken = jwt.sign(payload, 'secretkey')
        response.send({jwtToken})
      } else {
        response.status(400)
        response.send('Invalid password')
      }
    }
  } catch (e) {
    process.exit(1)
  }
})

app.get('/states', handler, async (request, response) => {
  const getstates = `SELECT * FROM state`
  const states = await db.all(getstates)
  response.send(states.map(eachstate => stateobjecttodbresponse(eachstate)))
})

app.get('/states/:stateId/', handler, async (request, response) => {
  const {stateId} = request.params
  const getquery = `select * from state where state_id = '${stateId}'`
  const state = await db.get(getquery)
  response.send(stateobjecttodbresponse(state))
})

app.post('/districts/', handler, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) values (
  '${districtName}',
  ${stateId},
  ${cases},
  ${cured},
  ${active},
  ${deaths}
  );`
  const inserted = await db.run(insertQuery)
  const district_id = inserted.lastId
  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', handler, async (request, response) => {
  const {districtId} = request.params
  const query = `select * from district where district_id = ${districtId};`
  const getresult = await db.get(query)
  response.send(convertDistrictObjectoresponseObject(getresult))
})

app.delete('/districts/:districtId/', handler, async (request, response) => {
  const {districtId} = request.params
  const deletequery = `delete from district where district_id = ${districtId}`
  const result = await db.run(deletequery)
  response.send('District Removed')
})

app.put('/districts/:districtId/', handler, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, active, deaths} = request.body
  const updatequery = `update district set 
  district_name = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  active = ${active},
  deaths = ${deaths}
  where district_id = ${districtId};`
  await db.run(updatequery)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats', handler, async (req, res) => {
  const {stateId} = req.params
  const api8 = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id = '${stateId}';`
  const ans = await db.get(api8)
  res.send(ans)
})

module.exports = app
