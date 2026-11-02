# CampusCare: College Maintenance Complaint Management Backend

Students report broken fans, leaking taps, faulty lights, unreliable Wi-Fi, and other campus maintenance issues. Maintenance staff track each complaint from **Pending → In Progress → Resolved**.

This Node.js, Express and MongoDB assignment implements authentication and CRUD using separate models, controllers, routes and middleware. It adapts the assignment's [backend tutorial](https://www.youtube.com/watch?v=KOutPbKc9UM&t=2s) to a college maintenance problem; it is not a verbatim tutorial transcript. No frontend is required: demonstrate the API with Postman desktop.

## 1. Install and run a quick demonstration

Install Node.js 22 or newer and open a terminal in this folder:

```powershell
npm ci
npm run demo
```

Open `http://localhost:5000/api/health`. A successful response is:

```json
{ "success": true, "database": "connected" }
```

Demo mode starts a real temporary MongoDB process and creates a staff account:

| Email | Password |
| --- | --- |
| staff@campus.edu | StaffDemo123! |

The first demo/test run downloads a MongoDB binary and needs internet access. **Demo data is deleted when the process stops.** These credentials exist only in the temporary demo database. Use Atlas for the assignment's persistent database and choose your own staff password. Stop the server with Ctrl+C before changing modes. `npm ci --omit=dev` supports Atlas mode only; demo and tests require development dependencies.

Open `http://localhost:5000/` for interactive API documentation. Expand an endpoint, choose **Try it out**, and execute it from the browser. Register/log in, copy the response token, and paste it into **Authorize** to use protected endpoints. This is a backend API explorer; the assignment's Postman workflow remains available. JSON clients can request the home endpoint with `Accept: application/json`. The OpenAPI specification is at `/api/openapi.json`.

## 2. Set up MongoDB Atlas

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/) and create a project and cluster. Select a free option if available and review the selection before creating it.
2. Create a **database user**, separate from your Atlas login, with read/write access to the `campuscare` database.
3. In Network Access, add your laptop's current public IP. Update this if your network changes.
4. Open the cluster's **Connect → Drivers → Node.js** instructions and copy the connection string. See the [official connection guide](https://www.mongodb.com/docs/atlas/driver-connection/).
5. Create the local configuration file:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Edit `.env` locally. Paste the generated value into `JWT_SECRET`. Set `MONGODB_URI` to your actual connection string, replacing the username, password, and host placeholders and including `/campuscare` before the `?`. URL-encode special characters in the database password. Set `STAFF_NAME`, `STAFF_EMAIL`, and a `STAFF_PASSWORD` of at least 8 characters (at most 72 UTF-8 bytes).

```powershell
npm run create:staff
npm start
```

Run `create:staff` once per staff account. It refuses an existing email and never promotes an existing student account. Public registration creates students only. `npm run dev` restarts the server when source files change. `.env` is ignored by Git; never publish it or paste real credentials into screenshots.

Atlas setup requires your own account and connection string; the repository does not provision a cloud cluster automatically. Successful test/demo results alone do not confirm Atlas access.

## 3. Import and demonstrate in Postman desktop

1. Start either `npm run demo` or the configured Atlas server with `npm start`.
2. In Postman desktop, choose **Import**, then select `postman/CampusCare.postman_collection.json`.
3. Open the collection's **Variables**. `baseUrl` defaults to `http://localhost:5000`. For Atlas mode, replace `staffEmail` and `staffPassword` with the account you created.
4. Run requests **01–16 in order**, individually using Send or using the Collection Runner. The registration request generates a new student email/password on each run. Test scripts save student/staff tokens and complaint IDs to collection variables automatically. Select **No environment** to avoid environment variables overriding these collection values.
5. Show the complaint being created, edited while Pending, listed by staff, marked In Progress, then Resolved. The last two requests create and delete a separate pending complaint to demonstrate Delete.

Requests include HTTP status and success assertions. This collection is prepared for the desktop app; automated backend integration tests are a separate verification. Do not export or commit a Postman collection containing real staff passwords or saved bearer tokens.

## 4. API reference

Protected routes use `Authorization: Bearer <token>`. POST/PATCH requests use `Content-Type: application/json`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Database readiness (200 or 503) |
| POST | `/api/auth/register` | Public | Register a student; 201 |
| POST | `/api/auth/login` | Public | Login as student or staff; 200 |
| GET | `/api/auth/me` | Logged in | Current user |
| POST | `/api/complaints` | Student | Create own Pending complaint; 201 |
| GET | `/api/complaints` | Logged in | Student: own complaints; staff: all |
| GET | `/api/complaints/:id` | Owner or staff | Read one complaint |
| PATCH | `/api/complaints/:id` | Student owner | Edit pending complaint details |
| PATCH | `/api/complaints/:id/status` | Staff | Set complaint status |
| DELETE | `/api/complaints/:id` | Student owner | Withdraw a pending complaint |

Registration body:

```json
{ "name": "Asha Rao", "email": "asha@campus.edu", "password": "ChooseYourOwn123!" }
```

Login accepts `email` and `password`. Both return `{ "success": true, "token": "...", "user": { "id": "...", "name": "...", "email": "...", "role": "student" } }`. Password hashes never appear in API responses. Tokens expire after one day by default.

Create complaint body:

```json
{
  "title": "Broken classroom fan",
  "description": "The ceiling fan above the front row does not rotate.",
  "category": "Electrical",
  "location": "Block A, Room 203"
}
```

Categories (case sensitive): `Electrical`, `Plumbing`, `Wi-Fi`, `Furniture`, `Cleaning`, `Other`.

Students PATCH one or more of `title`, `description`, `category`, `location`. Staff PATCH `/status` with `{ "status": "In Progress" }`, `{ "status": "Resolved" }`, or `{ "status": "Pending" }`. All three statuses are allowed, including reopening a complaint. Students cannot assign ownership or status. Staff cannot edit complaint details or delete complaints.

List supports `?status=Pending&category=Electrical&page=1&limit=20`. The maximum limit is 100. Response: `{ "success": true, "page": 1, "limit": 20, "total": 1, "complaints": [...] }`. Create/read/update return `{ "success": true, "complaint": {...} }`. Delete returns `{ "success": true, "message": "Complaint withdrawn." }`.

Errors return `{ "success": false, "message": "..." }`:

| Code | Meaning |
| --- | --- |
| 400 | Invalid input, unknown fields, malformed JSON or invalid ID |
| 401 | Missing/invalid/expired token or incorrect credentials |
| 403 | Role cannot perform the operation |
| 404 | Missing complaint or complaint owned by another student |
| 409 | Duplicate email or complaint no longer Pending for edit/delete |
| 413 | Request body exceeds 16 KB |
| 429 | More than 30 registration/login attempts per IP per 15 minutes |
| 500 | Unexpected server error |

## 5. Understand the code for evaluation

```text
src/
  app.js                       Express configuration and route mounting
  server.js                    Configuration, MongoDB connection and server startup
  config/db.js                 Mongoose connection
  models/User.js               Account schema and unique email index
  models/Complaint.js          Complaint schema, owner reference and enums
  controllers/authController.js       Register, login and current user
  controllers/complaintController.js  CRUD and staff status updates
  routes/                     HTTP methods, paths and role guards
  middleware/                 JWT authentication and JSON errors
  utils/validation.js         Request field and password validation
scripts/                      Staff setup, temporary demo and collection generation
postman/                      Importable API demonstration collection
test/api.test.js              Integration tests with real temporary MongoDB
```

Request flow: **Postman → route → authentication/role middleware → controller → Mongoose model → MongoDB → JSON response**.

`User` stores name, unique email, a bcrypt password hash, role and timestamps. `Complaint` stores title, description, category, location, status, the student's ObjectId and timestamps. `populate()` shows the student's name/email to authorized readers. JWT identifies the account; its current role is loaded from the database on each request. Student queries include their owner ID. Pending edits/deletes include the status in the database operation so a concurrent staff update is respected.

Be ready to explain POST vs GET vs PATCH vs DELETE, route vs controller vs model, password hashing vs JWT authentication, why MongoDB credentials stay in `.env`, and how ownership checks prevent students accessing one another's complaints. Express 5 forwards rejected async handlers to the JSON error middleware ([official documentation](https://expressjs.com/en/guide/error-handling/)). Schema constraints use [Mongoose validation](https://mongoosejs.com/docs/validation.html).

## 6. Run verification

```powershell
npm test
```

Tests use an isolated temporary MongoDB, never your Atlas database. They exercise registration/login, hashed passwords, invalid/expired tokens, student ownership, staff permissions, input validation, filters, pending-only edits/deletes, and the full resolution workflow. The initial MongoDB binary download requires internet.

Verified on Node.js 24: all **10 integration tests passed**. The checked-in Postman collection also ran against the demo server using Newman: **16 requests, 32 assertions, 0 failures**. To repeat that collection check while the server is running:

```powershell
npm exec --yes --package newman -- newman run postman/CampusCare.postman_collection.json
```

For Atlas mode, override `staffEmail` and `staffPassword` in Postman rather than using the temporary demo account. Atlas connectivity must be verified separately after configuring your own cluster.

## 7. Publish the public GitHub repository

After reviewing the files and running the tests, authenticate your GitHub account and publish from this folder:

```powershell
gh auth login
git add .
git commit -m "Build CampusCare maintenance complaint API"
gh repo create campuscare-backend --public --source=. --remote=origin --push
```

This workspace already has Git initialized. In a fresh folder, run `git init` first. If `origin` already exists, inspect `git remote -v` before using the create command. You can also create an empty public repository on GitHub and follow its instructions to push an existing repository.

Submit the actual public repository URL printed by GitHub, and verify it opens while signed out. For evaluation, bring your laptop, start the server, open Postman and run the complaint workflow. Keep the README, lockfile, source, and Postman collection in the repository; keep credentials and `node_modules` out.

## Troubleshooting

- **Cannot reach MongoDB:** check Atlas database credentials, your current IP access entry, the cluster hostname, and whether the cluster is active.
- **Port already in use:** stop the previous server or set another `PORT` and update Postman's `baseUrl`.
- **401 in Postman:** run registration/login again to refresh the corresponding token. Restarting demo mode invalidates old tokens.
- **409 on student edit/delete:** staff has changed the status; only Pending complaints allow those operations.
- **Demo download fails:** allow the MongoDB download on your network, or use your configured Atlas connection with `npm start`.
