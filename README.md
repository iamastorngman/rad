# Chakastani Room

A private, Instagram-inspired group chat built with Python (Flask), HTML, CSS, and JavaScript.

## Features
- Password-protected entry screen
- Choose a chat display name
- Shared group chat for everyone using the same server
- Messages stored in a local SQLite database
- Near-live message updates (polling every 1.8 seconds)\n- Share image, video, and other files (24 MB per file)\n- Play shared videos directly in the chat
- Responsive layout for desktop and mobile

## Run on Windows

1. Install Python 3.10 or newer.
2. Open Command Prompt in this folder.
3. Install the dependency:

   ```bat
   py -m pip install -r requirements.txt
   ```

4. Start the server:

   ```bat
   py app.py
   ```

5. Open this address in your browser:

   `http://127.0.0.1:5000`

Room password: `wearebestfriends`

## Let friends on the same Wi-Fi join

- Keep the server running on your PC.
- Find your PC's local IPv4 address by running `ipconfig` in Command Prompt.
- On another device connected to the same Wi-Fi, open `http://YOUR-PC-IP:5000`.
- If Windows Firewall asks, allow Python on your private network.

## Important security notes before putting it on the public internet

The requested room password is configured as the default. Anyone who knows it can enter the same room. For a public deployment, set a strong `CHAT_PASSWORD` and a random `SECRET_KEY` as environment variables, use HTTPS, and add per-user accounts/rate limiting. Do not expose the development server directly to the public internet.

Example PowerShell setup:

```powershell
$env:CHAT_PASSWORD = "replace-with-a-long-private-password"
$env:SECRET_KEY = "replace-with-a-long-random-secret"
py app.py
```

Messages are stored in `chat.db` beside `app.py`. Back up that file if you want to keep chat history.


## Deploy globally on Render (starter deployment)

This project can be deployed as a public website on Render:

1. Create a GitHub account and a new **private** repository.
2. Upload the contents of this project folder to that repository.
3. Create a Web Service in Render and connect the repository.
4. Use these settings:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
5. Add environment variables in Render:
   - `CHAT_PASSWORD` = your private room password
   - `SECRET_KEY` = a long random secret (do not share it)
6. Deploy. Render will give you a public `https://...onrender.com` address.

Before using this for real conversations, note:
- The current starter version uses SQLite. On typical cloud web-service filesystems, local files may be temporary and can be lost during redeploys/restarts. Use a managed PostgreSQL database and update the app's database connection before relying on persistent chat history.
- A single shared room password means everyone who knows it enters the same room. It is not individual accounts or private one-to-one messaging.
- Use HTTPS, a strong password, rate limiting, and a private GitHub repository. Do not publish secrets in source code.
