import { describe, expect, it } from 'vitest';
import { twilioSignature, twiml, validTwilioSignature } from './twilio';

describe('Twilio webhook signatures', () => {
  // The example from Twilio's security documentation.
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
  it('computes the documented signature', () => {
    expect(twilioSignature('12345', url, params)).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });
  it('rejects a wrong or missing signature, or changed params', () => {
    expect(validTwilioSignature('12345', url, params, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=')).toBe(true);
    expect(validTwilioSignature('12345', url, params, null)).toBe(false);
    expect(validTwilioSignature('wrong', url, params, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=')).toBe(false);
    expect(validTwilioSignature('12345', url, { ...params, Digits: '9999' }, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=')).toBe(false);
  });
  it('escapes TwiML replies', () => {
    expect(twiml('a & <b>')).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Message>a &amp; &lt;b&gt;</Message></Response>');
    expect(twiml()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });
});
