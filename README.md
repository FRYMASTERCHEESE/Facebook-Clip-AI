# Facebook Clip AI — Free AI Director

This is a completely separate Facebook-only project. It does not modify or depend on your YouTube Video-clipper repository.

## $0-by-design

This build contains:
- no Runway API
- no OpenAI video API
- no paid model key
- no per-generation billing integration

The app can be hosted on GitHub Pages, and the included Facebook upload Worker can be kept on a free Cloudflare Worker plan subject to that provider's free-tier limits.

## One-button workflow

After the one-time Facebook/Meta setup:

1. Choose one of the Facebook Pages you manage.
2. Type a topic.
3. Press **AI DIRECTOR: CREATE + UPLOAD REEL**.
4. The app searches Wikimedia Commons for Public Domain/CC0 video.
5. It downloads 2–4 matching sources.
6. It creates a fresh 720×1280 vertical montage in your browser.
7. It automatically applies crop, zoom variation and style/colour treatment.
8. It can add an on-screen hook.
9. It can generate a simple original ambient soundtrack mathematically in the browser instead of using copyrighted music.
10. It generates the Facebook caption and hashtags.
11. It uploads the finished Reel to your selected Facebook Page.

## Own-video mode

You can also choose a video you own/have permission to publish.

Compatible portrait MP4 files use a fast no-recompression path when possible, which improves speed and preserves quality.

## Copyright approach

Automatic source discovery only accepts Wikimedia Commons files whose metadata indicates Public Domain or CC0.

The app:
- does not rip YouTube videos
- does not rip Facebook videos
- does not remove someone else's watermark
- does not automatically add copyrighted commercial music
- does not add an app watermark

No software can honestly guarantee that every metadata record is legally correct in every jurisdiction, but this build deliberately avoids ordinary copyrighted search results.

## Facebook permissions

The Meta app requests:
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Meta may require App Review / Advanced Access depending on how broadly the app is used.

Never commit a Meta App Secret to GitHub.
