import { zohoRequest } from './client.js';

export async function lookupContactByPhone(phone) {
  try {
    const result = await zohoRequest({
      method: 'GET',
      path: '/Contacts/search',
      params: { api_name: 'Phone', value: phone, comparator: 'equal' },
    });
    const matches = result?.data ?? [];
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    if (error.response?.status === 204) return null;
    throw error;
  }
}

export async function createContact({ name, phone, email, address }) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts[0] : null;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];

  const record = {
    Last_Name: lastName,
    Email: email,
    Phone: phone,
    Mobile: phone,
    Service_Address: address,
    Billing_Address: address,
  };
  if (firstName) record.First_Name = firstName;

  const createResult = await zohoRequest({
    method: 'POST',
    path: '/Contacts',
    data: { data: [record] },
  });

  const contactId = createResult?.data?.Contacts?.[0]?.id;
  if (!contactId) {
    throw new Error(`Contact creation: no id in response. Raw: ${JSON.stringify(createResult)}`);
  }

  const getResult = await zohoRequest({
    method: 'GET',
    path: `/Contacts/${contactId}`,
  });

  const fullRecord = getResult?.data?.Contacts?.[0] ?? getResult?.data?.[0] ?? null;
  const addressId =
    fullRecord?.Service_Address?.id ??
    fullRecord?.Billing_Address?.id ??
    null;

  return { id: contactId, addressId };
}

export async function createRequest({
  contactId,
  addressId,
  summary,
  description,
  serviceRequired,
  serviceLocation,
  priority = 'Medium',
  preferredTime,
  dueDate,
}) {
  const record = {
    Summary: summary,
    Contact: contactId,
    Service_Address: { id: addressId },
    Billing_Address: { id: addressId },
    Service_Required__C: serviceRequired,
    Service_Location__C: serviceLocation,
    Priority: priority,
  };

  if (dueDate) record.Due_Date = dueDate;

  if (description || preferredTime) {
    record.Preference = {};
    if (preferredTime) record.Preference.Preferred_Time = preferredTime;
    if (description) record.Preference.Preference_Note = description;
  }

  const result = await zohoRequest({
    method: 'POST',
    path: '/Requests',
    data: { data: [record] },
  });

  const id = result?.data?.Requests?.[0]?.id;
  if (!id) throw new Error(`Request creation: no id in response. Raw: ${JSON.stringify(result)}`);
  return id;
}

export async function deleteContact(contactId) {
  return zohoRequest({
    method: 'DELETE',
    path: `/Contacts/${contactId}`,
  });
}

export async function deleteRequest(requestId) {
  return zohoRequest({
    method: 'DELETE',
    path: `/Requests/${requestId}`,
  });
}
