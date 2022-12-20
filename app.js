const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const https = require('https');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const fs = require('fs');

let rawdata = fs.readFileSync('keys.json');
let keys = JSON.parse(rawdata)

var client_id = keys['CLIENT_ID'];
var redirect_uri = keys['REDIRECT_URI'];

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

async function generateCodeChallenge(code_verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
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
  }).catch((err) => {res.redirect("/login")});
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
        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
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
      res.send({'access_token': access_token, 'refresh_token': refresh_token});
    } else {
      res.redirect("/login");
    }
  });
});

app.listen(8888, () => {
  console.log("listening on port 8888...");
});

module.exports = app;