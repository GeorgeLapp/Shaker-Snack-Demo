// clientTests.mjs
//
// This script runs a set of end‑to‑end tests against the Service Menu API.
// It assumes that the API server is already running locally on port 8080
// and exposes the routes defined in the specification (see serviceMenuApi.mjs).
// The tests simulate a typical service engineer's workflow: logging in with a
// PIN, inspecting and modifying cell properties, merging cells, assigning
// products, running diagnostics and fetching logs.

const BASE_URL = 'http://localhost:8080/api/v1';

// Helper to perform fetch with JSON body and parse response
async function fetchJson(endpoint, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers }, body: undefined };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, init);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('🔐 Testing login with invalid PIN...');
  const invalidLogin = await fetchJson('/auth/login', { method: 'POST', body: { pin: '0000' } });
  console.log(`  Expected status 401, got ${invalidLogin.status}`);
  console.log(invalidLogin.status === 401 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log('🔐 Testing login with valid PIN...');
  const login = await fetchJson('/auth/login', { method: 'POST', body: { pin: '1234' } });
  const token = login.data && login.data.accessToken;
  console.log(`  Expected status 200 and token, got status ${login.status} and token ${token ? 'present' : 'absent'}`);
  if (!token) throw new Error('Valid login failed, cannot continue tests');
  console.log('  ✅ Passed\n');

  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('📦 Fetching list of cells...');
  const cellsRes = await fetchJson('/cells', { headers: authHeaders });
  const cells = Array.isArray(cellsRes.data) ? cellsRes.data : [];
  console.log(`  Retrieved ${cells.length} cells`);
  console.log(cells.length > 0 ? '  ✅ Passed\n' : '  ❌ Failed\n');
  const firstCell = cells[0];
  if (!firstCell) throw new Error('No cells returned by API');

  console.log(`🔄 Updating stock for cell ${firstCell.id} (row ${firstCell.row})...`);
  const newStock = Math.min(firstCell.capacity, (firstCell.stock || 0) + 1);
  const updateStock = await fetchJson(`/cells/${firstCell.id}/stock`, { method: 'PUT', headers: authHeaders, body: { stock: newStock } });
  console.log(`  Update stock responded with status ${updateStock.status}`);
  console.log(updateStock.status === 200 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log(`🧯 Filling row ${firstCell.row} to max capacity...`);
  const fillRow = await fetchJson('/cells/stock/fill-row', { method: 'POST', headers: authHeaders, body: { row: firstCell.row } });
  console.log(`  Fill row responded with status ${fillRow.status}`);
  console.log(fillRow.status === 204 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log(`🔧 Setting capacity for row ${firstCell.row} to ${firstCell.capacity + 1}...`);
  const newCapacity = (firstCell.capacity || 0) + 1;
  const setCapacity = await fetchJson('/cells/capacity/set-for-row', { method: 'PUT', headers: authHeaders, body: { row: firstCell.row, capacity: newCapacity } });
  console.log(`  Set capacity responded with status ${setCapacity.status}`);
  console.log(setCapacity.status === 204 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log(`💰 Updating price for cell ${firstCell.id}...`);
  const newPrice = (firstCell.price || 0) + 10;
  const updatePrice = await fetchJson(`/cells/${firstCell.id}/price`, { method: 'PUT', headers: authHeaders, body: { price: newPrice } });
  console.log(`  Update price responded with status ${updatePrice.status}`);
  console.log(updatePrice.status === 200 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log('🛍️ Fetching list of products...');
  const productsRes = await fetchJson('/products', { headers: authHeaders });
  const products = Array.isArray(productsRes.data) ? productsRes.data : [];
  console.log(`  Retrieved ${products.length} products`);
  console.log(products.length > 0 ? '  ✅ Passed\n' : '  ❌ Failed\n');
  if (products.length > 1) {
    console.log(`🛒 Assigning second product (${products[1].id}) to cell ${firstCell.id}...`);
    const assignProduct = await fetchJson(`/cells/${firstCell.id}/product`, { method: 'PUT', headers: authHeaders, body: { productId: products[1].id } });
    console.log(`  Assign product responded with status ${assignProduct.status}`);
    console.log(assignProduct.status === 200 ? '  ✅ Passed\n' : '  ❌ Failed\n');
  }

  if (cells.length >= 2) {
    console.log(`🧬 Merging first two cells: ${cells[0].id}, ${cells[1].id}...`);
    const merge = await fetchJson('/cells/merge', { method: 'POST', headers: authHeaders, body: { cellIds: [cells[0].id, cells[1].id] } });
    console.log(`  Merge responded with status ${merge.status}`);
    console.log(merge.status === 204 ? '  ✅ Passed\n' : '  ❌ Failed\n');
  }

  console.log(`🧪 Running diagnostics on first three cells...`);
  const testCells = cells.slice(0, 3).map(c => c.id);
  const diagnostics = await fetchJson('/diagnostics/test-cells', { method: 'POST', headers: authHeaders, body: { cellIds: testCells } });
  console.log(`  Diagnostics responded with status ${diagnostics.status}`);
  const diagResults = diagnostics.data && diagnostics.data.results;
  console.log(diagResults && Array.isArray(diagResults) ? `  ✅ Passed (results: ${diagResults.length} items)\n` : '  ❌ Failed\n');

  console.log('📄 Fetching latest logs (limit 5)...');
  const logsRes = await fetchJson('/diagnostics/logs?limit=5', { headers: authHeaders });
  const logs = Array.isArray(logsRes.data) ? logsRes.data : [];
  console.log(`  Retrieved ${logs.length} log entries`);
  console.log(logs.length > 0 ? '  ✅ Passed\n' : '  ❌ Failed\n');

  console.log('✅ All tests executed. Review output above for pass/fail status.');
}

runTests().catch(err => {
  console.error('❌ Test execution aborted due to error:', err);
});