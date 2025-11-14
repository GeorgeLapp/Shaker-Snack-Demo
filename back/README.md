# Shaker Snack Backend

Node.js backend server that exposes API endpoints for the Shaker Snack demo front-end.

## Available scripts

- `npm start` - launch the server in production mode.
- `npm run dev` - launch the server with the same configuration for local development.

## Configuration

Environment variables:

- `PORT` - port to bind the HTTP server. Defaults to `4000`.
- `ALLOWED_ORIGIN` - CORS header value for `Access-Control-Allow-Origin`. Defaults to `*`.
- `GOODS_DB_PATH` - optional absolute or relative path to the `goods.db` SQLite database with the product catalog. Defaults to `../Telemetry/goods.db` relative to the project root.
- `PRODUCTS_DB_PATH` - legacy override for the database path (kept for backwards compatibility).
- `STATIC_MEDIA_ROOT` - optional absolute or relative path to the directory with media assets. Defaults to `../SnackMedia` relative to the project root.
- `STATIC_ROUTE_PREFIX` - public URL prefix used to expose static assets. Defaults to `/media`.
- `VENDING_CONTROLLER_API_URL` - base URL of the hardware controller HTTP API (for example `http://127.0.0.1:3000/api/v1`). Defaults to that local URL.
- `VENDING_CONTROLLER_REQUEST_TIMEOUT_MS` - optional timeout in milliseconds for HTTP calls to the controller API. Defaults to `10000`.
- `VENDING_CONTROLLER_VEND_TIMEOUT_MS` - optional timeout in milliseconds passed as `timeoutMs` when invoking `/vend/simple` on the controller. The controller default is used when omitted.

## Data source

Product information is loaded from the `goods.db` SQLite database that ships with the Telemetry module. The backend joins `matrix_cell_config`, `catalog_product`, and `catalog_brand` to produce the matrix: each enabled cell inherits its row number, price (converted from `price_minor`), absolute `img_url`, brand name, and nutritional data from the catalog tables. Updating `goods.db` immediately affects `/api/product-matrix` responses.

## Static assets

Image files for the vending machine live in the `SnackMedia` directory. They are exposed by the backend under `${STATIC_ROUTE_PREFIX}` (defaults to `/media`), so a file stored at `SnackMedia/images/01.jpg` is available at `http://localhost:4000/media/images/01.jpg` when running locally.

## API

- `GET /api/product-matrix` - returns the full product matrix.
- `POST /api/start-sale` - accepts `{ "cellNumber": number }` and returns `{ "success": true }`.
- `POST /api/issue-product` - accepts `{ "cellNumber": number }`, triggers a `/vend/simple` request against the controller API, and mirrors its success response.

Each handler logs the call metadata alongside the incoming payload for observability.

## Vending controller integration

The `/api/issue-product` endpoint acts as a proxy to the HTTP server located in `Controller/vending-http-api.mjs`. Run that service separately (for example on `http://127.0.0.1:3000/api/v1`) and point `VENDING_CONTROLLER_API_URL` to it. When the purchase workflow in the front-end reaches the dispense stage it calls `/api/issue-product`, which now relays the request to `/vend/simple` and surfaces hardware faults to the UI.

## Running locally

```bash
npm install
npm run dev
```

Ensure that the SQLite database file is located at the default path (`../Telemetry/goods.db`) or provide a custom location through `GOODS_DB_PATH`/`PRODUCTS_DB_PATH` before starting the server. Media files are served from `../SnackMedia` by default; adjust `STATIC_MEDIA_ROOT` if you store them elsewhere. Then open `http://localhost:4000/api/product-matrix`, request an asset such as `http://localhost:4000/media/images/01.jpg`, or use the front-end pointed to the same origin.
