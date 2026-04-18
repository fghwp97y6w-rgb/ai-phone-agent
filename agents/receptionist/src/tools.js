import twilio from 'twilio';
import {
  lookupContactByPhone,
  createContact,
  createRequest,
} from '../../zoho-scribe/src/index.js';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const toolDefinitions = [
  {
    name: 'lookupContactByPhone',
    description:
      'Look up an existing HandyGo customer by their phone number. Use this early in the call if the caller is dialing from a number we might recognise. Returns the contact record (with id and Service_Address.id) or null if no match.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number in international format, e.g. +97455123456' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'createContact',
    description:
      'Create a new HandyGo customer record in Zoho FSM. Use this when the caller is not already a customer. Returns {id, addressId} — keep both for createRequest.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Caller full name' },
        phone: { type: 'string', description: 'Phone number in international format' },
        email: { type: 'string', description: 'Email address. If unknown, pass an empty string.' },
        address: {
          type: 'object',
          description:
            'Structured address. Used for BOTH service and billing — do not collect a separate billing address.',
          properties: {
            Street_1: { type: 'string', description: 'Street name + building/villa number' },
            Street_2: { type: 'string' },
            City: { type: 'string', description: 'e.g. Doha, Lusail, Al Wakrah' },
            State: { type: 'string' },
            Country: { type: 'string', description: 'e.g. Qatar' },
            Zip_Code: { type: 'string' },
          },
          required: ['Street_1', 'City', 'Country'],
        },
      },
      required: ['name', 'phone', 'email', 'address'],
    },
  },
  {
    name: 'createRequest',
    description:
      'Create the Zoho FSM Request (job ticket) for this booking. Always call this before ending the call, unless the call was a wrong number or general info enquiry.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'From createContact or lookupContactByPhone' },
        addressId: { type: 'string', description: 'From createContact (.addressId) or lookupContactByPhone (.Service_Address.id)' },
        summary: { type: 'string', description: 'Short one-liner, e.g. "AC cleaning — 6 units"' },
        description: { type: 'string', description: 'Full notes: issue detail, urgency context, preferred timing, anything the technician should know' },
        serviceRequired: {
          type: 'string',
          enum: ['AC Maintenance', 'Electrical', 'Plumbing', 'General Maintenance', 'Inspection'],
        },
        serviceLocation: { type: 'string', description: 'Free-text address line for the technician' },
        priority: {
          type: 'string',
          enum: ['High', 'Medium', 'Low'],
          description: 'Use "High" for emergencies, otherwise default to "Medium"',
        },
        preferredTime: { type: 'string', description: 'Free-text preferred time window, e.g. "Tomorrow 10am–12pm"' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD if a hard deadline exists' },
      },
      required: ['contactId', 'addressId', 'summary', 'description', 'serviceRequired', 'serviceLocation'],
    },
  },
  {
    name: 'end_call',
    description:
      'End the call gracefully after completing the caller\'s request or when the caller is ready to hang up. Always say goodbye first.',
    input_schema: { type: 'object', properties: {} },
  },
];

export async function executeTool(name, args, context) {
  switch (name) {
    case 'lookupContactByPhone':
      return lookupContactByPhone(args.phone);
    case 'createContact':
      return createContact(args);
    case 'createRequest':
      return createRequest(args);
    case 'end_call':
      if (!context?.callSid) throw new Error('end_call: missing callSid in context');
      await twilioClient.calls(context.callSid).update({ status: 'completed' });
      return { ended: true };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
