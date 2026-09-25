# Facebook Clip AI

A completely separate Facebook-only Reel creator/publisher.

This project does **not** depend on or modify the existing YouTube Clip AI project.

## What it does

- Upload a local video.
- Pick a section of the video.
- Crop/export it as a 720×1280 9:16 MP4 Reel.
- Generate simple Facebook caption/hashtag copy.
- Download the finished Reel.
- Optionally publish it to a Facebook Page through the included Cloudflare Worker.

## Important Facebook setup

Facebook Page publishing requires a Meta app and a Page access token with the permissions Meta requires for Page publishing. Common Page permissions include:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Your Meta app may also require App Review / Advanced Access before other people can use those permissions.

Do not put a Meta App Secret or long-lived Page token directly in a public GitHub repository.

## Frontend deployment

You can place `index.html`, `styles.css`, and `app.js` in a brand-new GitHub repository and enable GitHub Pages.

Do not copy these files into your existing Video-clipper repository if you want the projects to stay fully separate.

## Worker deployment

The `worker` folder is a tiny proxy for Facebook Graph API calls and uploads.

1. Create a free Cloudflare account.
2. Install Wrangler locally or use Cloudflare's web editor.
3. Deploy the Worker.
4. Copy its `https://...workers.dev` URL.
5. Paste that URL into the Facebook Clip AI website.
6. Add your Facebook Page ID and Page Access Token.

The Worker does not contain your token and does not permanently store it.

## Security

The Page token is saved only to `sessionStorage`, so closing the browser tab/session clears it. It is sent over HTTPS to your Worker only when testing or publishing.

For a multi-user public product, replace this temporary token flow with a full Meta OAuth backend/session system before launch.

## Notes

The frontend uses FFmpeg WebAssembly from a CDN, so the first run can take longer while the browser downloads the video engine. Processing speed depends on the phone/computer and source video size.

Facebook API behavior and permission requirements can change. If Meta changes the Reels Publishing API, update the worker endpoints accordingly.
