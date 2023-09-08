require('dotenv').config({ path: __dirname + "/.env" });
const fastify = require("fastify"),
    querystring = require("querystring"),
    moment = require('moment');

const app = fastify({
    trustProxy: true,
    ignoreTrailingSlash: true,
    exposeHeadRoutes: false
});
app.register(require("@fastify/cors"));

const client_id = process.env.CLIENT_ID,
    client_secret = process.env.CLIENT_SECRET,
    redirect_uri = process.env.REDIRECT_URL

let token = process.env.USER_TOKEN,
    state = "",
    access_token,
    reqDate;
app.get('/login', function (req, res) {
    if (state.length > 0 && !!token) return res.send("you already have the key!");
    state = generateRandomString(16);
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id,
            scope: 'user-read-currently-playing user-read-playback-state',
            redirect_uri,
            state: state
        }));
});

app.get('/callback', async (req, res) => {
    if (!req.query.code || !req.query.state || (req.query.state !== state)) {
        if (req.query["error"]) return res.redirect("/");
        res.send("no code or wrong state");
        return;
    }
    const api = new URLSearchParams();
    api.append('grant_type', 'authorization_code');
    api.append('redirect_uri', redirect_uri);
    api.append('code', req.query.code);
    const data = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        body: api,
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
        },
    }).then(r => r.json());
    process.env.USER_TOKEN = data.refresh_token;
    access_token = data.access_token;
    require('fs').writeFileSync("./.env", `
    CLIENT_ID=${client_id}
    CLIENT_SECRET=${client_secret}
    REDIRECT_URL=${redirect_uri}
    USER_TOKEN=${data.refresh_token}
    `, function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
    res.send("signed in!");
});

app.get('/spotify', async (request, reply) => {
    if (!reqDate || !access_token || moment(reqDate).diff(Date.now(), "seconds") < 0) {
        const api = new URLSearchParams();
        api.append('grant_type', 'refresh_token');
        api.append('refresh_token', process.env.USER_TOKEN);
        const data = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            body: api,
            headers: {
                'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
            }
        }).then(r => r.json());
        if (data["error"]) return { error: data["error"] }
        access_token = data.access_token;
        reqDate = moment().add(data.expires_in, "seconds").toDate().getTime();
    }
    return await Promise.all([
        fetch('https://api.spotify.com/v1/me/player', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        }).then((res) => res?.json()).catch(console.error),
        fetch('https://api.spotify.com/v1/me/player/queue', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        }).then((res) => res?.json()).catch(console.error)
    ]).then(([data, queue]) => {
        if (!data) return { error: "NO_DATA" }
        if (data["error"]) return { error: data["error"] };
        const dg = (s) => s.length == 1 ? "0" + s : s
        const gtf = (ms) => `${moment.duration(ms).get("minutes")}:${dg(moment.duration(ms).get("seconds").toString())}`
        const info = {
            is_active: data.device.is_active,
            type: data.device.type,
            shuffle_state: data.shuffle_state,
            repeat_state: data.repeat_state,
            is_playing: data.is_playing,
            timestamp: data.timestamp
        };
        let finito = info;
        if (info.is_playing) finito = {
            ...info,
            song: data.item.name,
            progress: {
                from: gtf(data.progress_ms),
                to: gtf(data.item.duration_ms)
            },
            artists: data.item.artists.map((a) => ({
                name: a.name,
                url: a.external_urls.spotify
            })),
            progress_ms: data.progress_ms,
            duration_ms: data.item.duration_ms,
            image: data.item.album?.images.pop(),
            url: data.item.external_urls.spotify,
            reqTime: request.date
        }
        if (queue) {
            if (queue["error"]) return { error: data["error"] };
            finito.queue = queue.queue?.map((d) => ({
                name: d.name,
                artists: d.artists?.map((a) => a.name).join(", "),
                image: d.album?.images.pop()
            }));
        }
        return finito;
    });

});

app.listen({
    port: 8080,
    host: "127.0.0.1"
}, (err, adress) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    } else {
        console.log(`Fastify app is running in ${adress}`);
        console.log(app.printRoutes());
    }
});

function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};