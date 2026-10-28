# Birthday video-wish backend

The API stores wish metadata and approval status in MongoDB and stores video files in Cloudinary. Public submissions stay out of the birthday page until explicitly approved.

## Features

- `POST /api/wishes`: accept a name, message, and live-recorded video up to 20 seconds and 100 MB.
- `POST /api/access/verify`: validate a birthday-page or video-wish page password.
- `GET /api/wishes`: list approved video wishes for an authenticated birthday page.
- `POST /api/admin/login`: issue a short-lived admin bearer token.
- `GET /api/admin/wishes`: list pending and approved videos for the authenticated admin.
- `PATCH /api/admin/wishes/:id`: approve or reject a pending submission.
- `DELETE /api/admin/wishes/:id`: permanently delete a video wish and its Cloudinary video.
- `GET /api/health`: API health check.

Rejected videos are deleted from Cloudinary. Admin bearer tokens expire after two hours and are kept in page memory, so refreshing the admin page requires signing in again.

## Requirements

- Node.js 20 or newer
- A MongoDB database (MongoDB Atlas is suitable)
- A Cloudinary account

## Local setup

1. Install frontend dependencies:

   ```powershell
   cd client
   npm install
   ```

2. Install backend dependencies:

   ```powershell
   cd ..\server
   npm install
   ```

3. Copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   The example intentionally leaves password hashes and `JWT_SECRET` blank. Set the MongoDB URI, Cloudinary credentials, admin username, and a random `JWT_SECRET` of at least 32 characters. Keep `.env` private and never commit it.

4. Generate hashes for the two page passwords:

   ```powershell
   npm run pages:hash
   ```

   Enter two different passwords. Copy the generated hashes—not the passwords—into `BIRTHDAY_PAGE_PASSWORD_HASH` and `WISH_PAGE_PASSWORD_HASH` in `server/.env`.

5. Generate a bcrypt hash for the admin password:

   ```powershell
   npm run admin:hash
   ```

   Copy the generated hash into `ADMIN_PASSWORD_HASH` in `server/.env`.

6. Start the API in one terminal:

   ```powershell
   npm run dev
   ```

7. Start the frontend in another terminal:

   ```powershell
   cd ..\client
   npm run dev
   ```

   Open the Vite URL shown in the terminal. The intro uses one password field and one Submit button: the entered password opens either Amritha Ma’am’s celebration or the video-wish submission page. Video wishes are recorded live with the device camera and microphone, and recording automatically stops at 20 seconds. The browser requires camera permission and a secure context (HTTPS or localhost). The admin page is `/admin`.

## Production

Deploy the frontend and API to HTTPS-capable hosts. Set `CLIENT_ORIGINS` on the API to the exact frontend origin(s), and set `VITE_API_BASE_URL` on the frontend to the API origin before running the production build. Configure `TRUST_PROXY` to match the deployment provider when the API runs behind a reverse proxy.

Page passwords are checked by the API, not by frontend-only logic. Each page access token expires after eight hours. Birthday-video access and video uploads each require the matching token; admin approval login remains separate.

No MongoDB URI, Cloudinary API key/secret, admin password, or signing secret is included in source control. Configure these as private environment variables on the deployment host.
