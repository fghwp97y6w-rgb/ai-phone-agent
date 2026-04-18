import {
  lookupContactByPhone,
  createContact,
  createRequest,
  deleteContact,
  deleteRequest,
} from './src/index.js';

const isoStamp = new Date().toISOString();
const epochStamp = Date.now();

const TEST_PHONE = `+97444444444${String(epochStamp).slice(-4)}`;

const TEST_CONTACT = {
  name: `TEST DELETE ME - ${isoStamp}`,
  phone: TEST_PHONE,
  email: `test+${epochStamp}@example.com`,
  address: {
    Street_1: 'Zone 24, Street 840, Building 34',
    City: 'Doha',
    Country: 'Qatar',
  },
};

const TEST_REQUEST = {
  summary: 'TEST - automated test, safe to delete',
  description:
    'This is an automated test record from zoho-scribe test.js. If you see this in Zoho FSM, the automatic cleanup failed. Safe to delete.',
  serviceRequired: 'AC Maintenance',
  serviceLocation: 'Zone 24, Street 840, Building 34 — Al Muntazah, Doha',
  priority: 'Medium',
};

let createdContactId = null;
let createdRequestId = null;
let exitCode = 0;

function logStep(name) {
  console.log(`\n=== ${name} ===`);
}

function logError(step, error) {
  console.error(`FAIL: ${step}`);
  if (error.response) {
    console.error(`  HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
  } else {
    console.error(`  ${error.message}`);
  }
}

try {
  logStep('Step 1: Lookup by phone (sanity check)');
  const existing = await lookupContactByPhone(TEST_PHONE);
  console.log(existing ? `Found existing contact: ${existing.id}` : 'No existing contact (expected)');

  logStep('Step 2: Create test contact');
  const contact = await createContact(TEST_CONTACT);
  createdContactId = contact.id;
  console.log(`Contact created: id=${contact.id}, addressId=${contact.addressId}`);
  if (!contact.addressId) {
    throw new Error('No addressId returned — cannot create Request');
  }

  logStep('Step 3: Create test request');
  const requestId = await createRequest({
    contactId: contact.id,
    addressId: contact.addressId,
    ...TEST_REQUEST,
  });
  createdRequestId = requestId;
  console.log(`Request created: id=${requestId}`);
} catch (error) {
  logError('Create flow', error);
  exitCode = 1;
}

logStep('Step 4: Cleanup');

if (createdRequestId) {
  try {
    await deleteRequest(createdRequestId);
    console.log(`Deleted request ${createdRequestId}`);
  } catch (error) {
    logError(`Delete request ${createdRequestId}`, error);
    console.error(`  MANUAL CLEANUP NEEDED: delete Request ${createdRequestId} in Zoho UI`);
    exitCode = 1;
  }
}

if (createdContactId) {
  try {
    await deleteContact(createdContactId);
    console.log(`Deleted contact ${createdContactId}`);
  } catch (error) {
    logError(`Delete contact ${createdContactId}`, error);
    console.error(`  MANUAL CLEANUP NEEDED: delete Contact ${createdContactId} in Zoho UI`);
    exitCode = 1;
  }
}

logStep('Result');
console.log(exitCode === 0 ? 'PASS — all steps succeeded' : 'FAIL — see errors above');
process.exit(exitCode);
