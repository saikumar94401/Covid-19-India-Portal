const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(express.json());

const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken = "";
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateTableDataToCamelCase = (ob) => {
  return {
    stateId: ob.state_id,
    stateName: ob.state_name,
    population: ob.population,
  };
};

const convertDistrictTableDataToCamelCase = (ob) => {
  return {
    districtId: ob.district_id,
    districtName: ob.district_name,
    stateId: ob.state_id,
    cases: ob.cases,
    cured: ob.cured,
    active: ob.active,
    deaths: ob.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const userDetailsQuery = `select * from user where username= '${username}'`;
  const userDetails = await db.get(userDetailsQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const compareResult = await bcrypt.compare(password, userDetails.password);
    if (compareResult === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_token");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const query = `select * from state `;
  const result = await db.all(query);
  response.send(result.map((each) => convertStateTableDataToCamelCase(each)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const query = `select * from state where state_id=${stateId}`;
  const result = await db.get(query);
  response.send(convertStateTableDataToCamelCase(result));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  console.log(districtName);
  const query = `insert into district(district_name,state_id,cases,cured,active,deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `select * from district where district_id=${districtId}`;
    const result = await db.get(query);
    response.send(convertDistrictTableDataToCamelCase(result));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `delete from district where district_id=${districtId}`;
    await db.run(query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const query = `update district 
    set 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where district_id=${districtId}`;
    await db.run(query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `select sum(cases) as totalCases ,
    sum(cured) as totalCured,sum(active) as totalActive, sum(deaths) as totalDeaths 
    from district where state_id=${stateId}`;
    const result = await db.get(query);
    response.send(result);
  }
);

module.exports = app;
