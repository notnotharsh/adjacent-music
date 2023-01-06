const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const https = require('https');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const sha256 = require('js-sha256');

var spawn = require('child_process').spawn
var child = spawn('pwd')

let rawdata = fs.readFileSync('keys.json');
let keys = JSON.parse(rawdata)

const remote = 1;
var client_id = keys['CLIENT_ID'];
var redirect_uri = keys['REDIRECT_URI'][remote];

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

async function generateCodeChallenge(code_verifier) {
  var hash = sha256.create();
  var hex_str = (hash.update(code_verifier).hex());
  var hashed_str = Buffer.from(hex_str, 'hex').toString('base64');
  return hashed_str
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

var stateKey = 'spotify_auth_state';
const code_verifier = generateRandomString(64);

var app = express();
app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  generateCodeChallenge(code_verifier).then((code_challenge) => {
    res.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: 'user-read-private user-top-read',
        redirect_uri: redirect_uri,
        state: state,
        code_challenge_method: "S256",
        code_challenge,
    }));
  }).catch((err) => {
    request.get({url: `https://docs.google.com/forms/d/e/1FAIpQLSeeX2Y6YzA19lXHLOcbKJORzZ-rgazKWB2squuADVVewHnwAA/formResponse?usp=pp_url&entry.1725414927=${err}&submit=Submit`}, function(error, response, body) {});
  });
});

app.get('/callback', function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        client_id: client_id,
        code_verifier: code_verifier
      },
      json: true
    };
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        
      var access_token = body.access_token,
        refresh_token = body.refresh_token;
      res.cookie("access_token", access_token, {expires: new Date(Date.now() + 3600000)});
      res.cookie("refresh_token", refresh_token);
      res.redirect('/');
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  var refresh_token = req.query.refresh_token;
  if (refresh_token != req.cookies.refresh_token) refresh_token = req.cookies.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {grant_type: 'refresh_token', refresh_token: refresh_token, client_id: client_id},
    json: true
  };
  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      var refresh_token = body.refresh_token;
      res.cookie("access_token", access_token, {expires: new Date(Date.now() + 3600000)});
      res.cookie("refresh_token", refresh_token);
      res.send({'access_token': access_token, 'refresh_token': refresh_token});
    } else {
      res.header("Access-Control-Allow-Origin", "*");
      res.redirect("/login");
    }
  });
});

app.get('/analysis', function(req, res) {
  var access_token = req.query.access_token;
  var path = "analysis/top_artists_" + generateRandomString(16) + ".json";
  var t_path = "analysis/top_tracks_" + generateRandomString(16) + ".json";
  var options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };

  const top_artists_req = https.get('https://api.spotify.com/v1/me/top/artists/?limit=50&time_range=long_term', options, function(response) {
    let data = '';
    response.on('data', (chunk) => { data = data + chunk.toString(); });
    response.on('end', () => {
      const body = JSON.parse(data);
      const top_artists = (JSON.stringify(body));
      fs.writeFileSync(path, top_artists);
      const python_genres = spawn('python3', ['analysis/genres.py', path]);
      var json_to_send = {};
      python_genres.stdout.on('data', function (data) {
        var json_string = data.toString();
        var genre_object = JSON.parse(json_string.replace(/'/g, "\""));
        json_to_send["genres"] = genre_object;
      });
      python_genres.on('close', (code) => {
        fs.unlink(path, (err) => {
          if (err) throw err;
          // console.log('deleted ' + path);
        });
        const top_tracks_req = https.get('https://api.spotify.com/v1/me/top/tracks/?limit=50&time_range=long_term', options, function(t_response) {
          let track_data = '';
          t_response.on('data', (chunk) => { track_data = track_data + chunk.toString(); });
          t_response.on('end', () => {
            const t_body = JSON.parse(track_data);
            var ids = "";
            for (const item in t_body["items"]) { 
              ids += t_body["items"][item]["id"];
              ids += ",";
            }
            ids = ids.substring(0, ids.length - 1);
            const features_req = https.get('https://api.spotify.com/v1/audio-features?ids=' + ids, options, function(f_res) {
              let feature_data = '';
              f_res.on('data', (chunk) => { feature_data = feature_data + chunk.toString(); });
              f_res.on('end', () => {
                fs.writeFileSync(t_path, feature_data);
                const python_tracks = spawn('python3', ['analysis/tracks.py', t_path]);
                python_tracks.stdout.on('data', function (data) {
                  var json_string = data.toString();
                  var feature_object = JSON.parse(json_string.replace(/'/g, "\""));
                  json_to_send["features"] = feature_object;
                });
                python_tracks.on('close', (code) => {
                  var dataToSend = JSON.stringify(json_to_send);
                  res.send((dataToSend));
                  fs.unlink(t_path, (err) => {
                    if (err) throw err;
                    // console.log('deleted ' + path);
                  });
                });
              })
            });
            features_req.on('error', (e) => {console.error(e)});
            features_req.end();
          });
        });
        top_tracks_req.on('error', (e) => {console.error(e)});
        top_tracks_req.end();
      });
    });
  });
  top_artists_req.on('error', (e) => {console.error(e)});
  top_artists_req.end();
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}...`);
});

module.exports = app;