const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const https = require('https');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const sha256 = require('js-sha256');
const axios = require('axios');

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
  res.header("Access-Control-Allow-Origin", "*");
  generateCodeChallenge(code_verifier).then((code_challenge) => {
    res.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: 'user-top-read playlist-modify-public',
        redirect_uri: redirect_uri,
        state: state,
        code_challenge_method: "S256",
        code_challenge,
    }));
  }).catch((err) => {
    console.log(err);
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
      res.redirect("/");
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
                  fs.unlink(t_path, (err) => {
                    if (err) throw err;
                    // console.log('deleted ' + path);
                  });
                  const me_req = https.get('https://api.spotify.com/v1/me', options, function(me_res) {
                    let me_data = '';
                    me_res.on('data', (chunk) => { me_data = me_data + chunk.toString(); });
                    me_res.on('end', () => {
                      const me_body = JSON.parse(me_data);
                      json_to_send["me"] = me_body;
                      var dataToSend = JSON.stringify(json_to_send);
                      res.send((dataToSend));
                    });
                  });
                  me_req.on('error', (e) => {console.error(e)});
                  me_req.end();
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

app.get('/recommend', function(req, res) {
  var access_token = req.query.access_token;
  var data = JSON.parse(req.query.data);
  var genres = data["genres"]["real"];
  let sortable_genres = [];
  for (var genre in genres) {
      sortable_genres.push([genre, genres[genre]]);
  }
  sortable_genres.sort(function(a, b) {
      return b[1] - a[1];
  });
  var num_groups = Math.ceil(sortable_genres.length);
  var genre_groups = [];
  var i = 0;
  while (i < num_groups) {
    let genre_string = "";
    let num_tracks = 0;
    var j = 0;
    while (((num_tracks < 1) && (j <= 5)) && (i < num_groups)) {
      genre_string += sortable_genres[i][0] + ",";
      num_tracks += sortable_genres[i][1];
      i++;
      j++;
    }
    genre_string = genre_string.substring(0, genre_string.length - 1);
    num_tracks = Math.floor(num_tracks);
    if (num_tracks > 0) genre_groups.push([genre_string, num_tracks]);
  }
  var features = data["features"]
  var options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };
  var uris = [];
  var done_num = 0;
  for (var i = 0; i < genre_groups.length; i++) {
    var genre_group = genre_groups[i];
    var url_ops = {
      seed_genres: genre_group[0],
      limit: genre_group[1],
      min_danceability: features["danceability"][0],
      max_danceability: features["danceability"][1],
      min_energy: features["energy"][0],
      max_energy: features["energy"][1],
      min_speechiness: features["speechiness"][0],
      max_speechiness: features["speechiness"][1],
      min_acousticness: features["acousticness"][0],
      max_acousticness: features["acousticness"][1],
      min_instrumentalness: features["instrumentalness"][0],
      max_instrumentalness: features["instrumentalness"][1],
      min_valence: features["valence"][0],
      max_valence: features["valence"][1],
    };
    var url = 'https://api.spotify.com/v1/recommendations?'
    for (var option in url_ops) {
      url += option + "=" + url_ops[option];
      url += "&"
    }
    url = url.substring(0, url.length - 1);
    const recommendations_req = https.get(url, options, function(response) {
      let t_data = '';
      response.on('data', (chunk) => { t_data = t_data + chunk.toString(); });
      response.on('end', () => {
        const body = JSON.parse(t_data);
        for (track in body["tracks"]) {
          uris.push(body["tracks"][track]["uri"]);
        }
        done_num++;
        if (done_num == genre_groups.length) {
          uris = uris.sort((a, b) => 0.5 - Math.random());
          var final_obj = {genre_groups: genre_groups, uris: uris}
          let theDate = new Date();
          var date_str =(theDate.toLocaleDateString('en-us', {month: '2-digit', day: '2-digit', year: 'numeric'}));
          var time_str = (theDate.toLocaleTimeString('en-us', {hour12: false, hour: "2-digit", minute: "2-digit"}));
          var playlist_name = (`adjacent music ${date_str} ${time_str}`);
          var person_url = (`https://api.spotify.com/v1/users/${data["me"]["id"]}/playlists`);
          axios.post(person_url, {
            name: playlist_name
          }, {headers: { 'Authorization': 'Bearer ' + access_token }}).then(function(pc_response) {
            pc_response_data = (pc_response)["data"];
            var playlist_id = pc_response_data["id"];
            final_obj["playlist_id"] = playlist_id;
            playlist_add_url = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;
            axios.post(playlist_add_url, {
              uris: uris
            }, {headers: { 'Authorization': 'Bearer ' + access_token }}).then(function(pa_response) {
              res.send(final_obj);
            }).catch(function(pa_error) {
              console.error(pa_error);
            });
          }).catch(function(error) {
            console.error(error);
          });
        }
      });
    });
    recommendations_req.on('error', (e) => {console.error(e)});
    recommendations_req.end();
  } 
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}...`);
});

module.exports = app;