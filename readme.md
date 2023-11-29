### use it to fetch currently playing song & queue.
> [!IMPORTANT]
> works fine with [yalinn/spotify-stasus-image](https://github.com/yalinn/spotify-status-image)\
> tr: veriyi işlemek için bir repo linki bıraktım

### Prerequisites: `(ön koşullar)`

* Spotify app [can be created in here](https://developer.spotify.com/dashboard "Developer Dashboard")
* your app's client secret & id

### you need a .env file which is in same directory with this file
> tr: bu dosyanın bulunduğu klasörde bulunan bir .env dosyasına ihtiyacın var

###### .env examle:

```sh
CLIENT_ID=spotify_app_id
CLIENT_SECRET=spotify_app_secret
REDIRECT_URL="http://localhost:8080/callback"
```
> you can change redirect_url
