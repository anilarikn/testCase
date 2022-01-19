const admin = require("firebase-admin");
const serviceAccount = require("./admin.json");
const swaggerDocument = require("./swagger.json");
const swaggerUi = require("swagger-ui-express");


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
var express = require("express");

var app = express();

app.use(express.json());
var jwt = require("jsonwebtoken");
const { values } = require("lodash");

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const addDays = (date, days) => {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.getTime();
};
const createToken = (username) => {
  const secret = "secret_key";
  const token = jwt.sign(
    {
      _username: username,
      dateNow: Date.now(),
      endDate: addDays(Date.now(), 3),
    },
    secret,
    { algorithm: "HS256" }
  );
  return token;
};

function validateToken(token) {
  const tokenBody = jwt.decode(token);
  if (!tokenBody) {
    return false;
  }
  const now = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return tokenBody.endDate > Date.now();
};

const users = db.collection("users");
app.post("/login", async function (req, res) {
  const reqBody = req.body;
  const check = await users
    .where("username", "==", reqBody.username)
    .where("password", "==", reqBody.password)
    .get();
  if (check.empty) {
    res.send("Kullanıcı adı veya şifre eşleşmedi.");
  } else {
    const token = createToken(reqBody.username);
    res.send({ token });
  }
});

app.post("/signup", async function (request, response) {
  const requestBody = request.body;
  const userCheck = await users
    .where("username", "==", requestBody.username)
    .get();
  if (userCheck.empty) {
    const requestBody = request.body;
    db.collection("users")
      .add(requestBody)
      .then(() => response.send("Admin Eklendi!"));
  } else {
    response.send("Kullanıcı adı sistemde bulunuyor!");
  }
});

app.post("/deleteadmin", function (req, res) {
  const token = req.header("Auth");
  if (token == null) {
    res.send("Token uyuşmadı!");
  } else {
    const checkToken = validateToken(token);
    if (checkToken) {
      const reqBody = req.body;
      const deleteAdmin_query = db
        .collection("users")
        .where("username", "==", reqBody.username)
        .get();

      deleteAdmin_query.then(function (querySnapshot) {
        if (querySnapshot._size === 0) {
          res.send("Kullanıcı bulunamadı.");
        } else {
          querySnapshot.forEach(function (doc) {
            doc.ref.delete();
            res.send("Kullanıcı silindi.");
          });
        }
      });
    } else {
      res.send("Lütfen giriş yapınız");
    }
  }
});

app.post("/addmovie", function (req, res) {
  const token = req.header("Auth");
  if (token == null) {
    res.send("Yetkiniz bulunmamaktadır.");
  } else {
    const checkToken = validateToken(token);
    if (checkToken) {
      const requestBody = req.body;
      db.collection("movies")
        .add(requestBody)
        .then(() => res.send("Film eklendi!"));
    } else {
      res.send("Lütfen giriş yapın.");
    }
  }
});

app.post("/addseries", function (req, res) {
  const token = req.header("Auth");
  if (token == null) {
    res.send("Yetkiniz bulunmamaktadır.");
  } else {
    const checkToken = validateToken(token);
    if (checkToken) {
      const requestBody = req.body;
      db.collection("tvseries")
        .doc(requestBody.seriesName)
        .set(requestBody)
        .then(() => res.send("Dizi eklendi!"));
    } else {
      res.send("Lütfen giriş yapın.");
    }
  }
});

app.post("/addseason/:id/:season", async function (req, res) {
  const token = req.header("Auth");
  const reqParams = req.params.id;
  const season = req.params["season"];
  if (token == null) {
    res.send("Yetkiniz bulunmamaktadır.");
  } else {
    const checkToken = validateToken(token);
    if (checkToken) {
      const requestBody = req.body;
      const series = db.collection("tvseries").doc(reqParams);
      const data = series.get();
      if (data.empty) {
        res.send("Dizi bulunamadı.");
      } else {
        const userDoc = await db
          .collection("tvseries")
          .doc(reqParams)
          .collection(season);
        userDoc.add(requestBody);
        res.send("Sezon eklendi!.");
      }
    } else {
      res.send("Lütfen giriş yapın.");
    }
  }
});

app.post("/addepisode/:id/:season/:episode", async function (req, res) {
  const token = req.header("Auth");
  const reqParams = req.params.id;
  const season = req.params["season"];
  const episode = req.params["episode"];
  if (token == null) {
    res.send("Yetkiniz bulunmamaktadır.");
  } else {
    const checkToken = validateToken(token);
    if (checkToken) {
      const requestBody = req.body;
      const series = db.collection("tvseries").doc(reqParams);
      const data = series.get();
      if (data.empty) {
        res.send("Dizi bulunamadı.");
      } else {
        const userDoc = await db
          .collection("tvseries")
          .doc(reqParams)
          .collection(season)
          .doc(episode)
          .set(requestBody);
        res.send("Bölüm eklendi!.");
      }
    } else {
      res.send("Lütfen giriş yapın.");
    }
  }
});

app.get("/getmovie/:id", async function (req, res) {
  const reqParams = req.params;
  const id = reqParams.id;
  const movie = await db.collection("movies").doc(id);
  const data = await movie.get();
  if (!data.exists) {
    res.status(400).send("Film bulunamadı.");
  } else {
    res.send(data.data());
  }
});

async function getEpisodes(id, seasonId) {
  const snapshot = await db
    .collection("tvseries")
    .doc(id)
    .collection(seasonId)
    .get();
  return  snapshot.docs.map((doc) => {
    const data = doc.data();

    return { [doc.id]: data };
  });
}
const allData =[]
app.get("/getseries/:id", async function (req, res) {
  const reqParams = req.params;
  const id = reqParams.id;
  const series = await db.collection("tvseries").doc(id);
  const data = await series.get();
  if (!data.exists) {
    res.status(400).send("Dizi bulunamadı.");
  } else {
    const seasons = await series.listCollections();
    Promise.all(seasons.map(async (season) => {
      await getEpisodes(id, season.id).then((values)=>{
        allData.push({[season.id]:JSON.stringify(values)});
      });
    })).then(()=>{
      allData.forEach((data)=>{
        Object.keys(data).forEach((seasonKey)=>{
          data[seasonKey] = JSON.parse(data[seasonKey]);
        })
      });
      res.send({...data.data(), seasons: allData})
    });
    
  }
});

app.listen(8000);
