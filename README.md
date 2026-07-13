# Bestra - High-Performance E2EE Mobile Chat

Bestra is a secure mobile chat application built with **ReactLynx**, **WebTransport**, and **Clerk**, featuring **End-to-End Encryption (E2EE)**.

## Project Structure

- `bestra/`: ReactLynx frontend.
- `backend/`: Node.js server with Prisma and WebTransport.
- `integrating-lynx-demo-projects/android/KotlinEmptyProject/`: Android shell for APK generation.

## Build Instructions

### 1. Build the Frontend
Navigate to the frontend directory and build the ReactLynx bundle. You must provide the backend URL so the APK knows where to connect:
```bash
cd bestra
npm install
# Replace with your actual server IP or URL
PUBLIC_SERVER_IP="your.server.ip" npm run build
```

### 2. Sync Bundle to Android Shell
Copy the generated bundle to the Android project's assets:
```bash
cp dist/main.lynx.bundle ../integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle
```

### 3. Build the Standalone APK

```bash
podman build -t bestra-android -f Dockerfile.android .
```
or

```bash
docker build -t bestra-android -f Dockerfile.android .
```
The resulting APK will be located at:
`integrating-lynx/android/KotlinEmptyProject/app/build/outputs/apk/debug/app-debug.apk`

## Development Notes

- **E2EE:** Uses in-memory RSA-OAEP keys. Keys are generated on app launch and cleared on close for this POC.
- **Networking:** Standalone APKs must point to a public IP or local network IP (not `localhost`). Update `bestra/src/lib/api.ts` with the correct `PUBLIC_BACKEND_URL`.
- **Environment Variables:** Must use the `PUBLIC_` prefix for injection into the Lynx bundle.
