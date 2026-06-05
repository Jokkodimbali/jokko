import {
  PhoneNumberValidator,
  normalizeSenegalPhoneNumber,
} from './phone-number.validator';

describe('PhoneNumberValidator', () => {
  const validator = new PhoneNumberValidator();

  it.each([
    ['77 000 00 00', '+221770000000'],
    ['71 000 00 00', '+221710000000'],
    ['+221 77 000 00 00', '+221770000000'],
    ['221770000000', '+221770000000'],
    ['00221770000000', '+221770000000'],
    ['0770000000', '+221770000000'],
    ['33 800 00 00', '+221338000000'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSenegalPhoneNumber(input)).toBe(expected);
    expect(validator.normalizeOrThrow(input)).toBe(expected);
  });

  it.each(['+33123456789', '+221690000000', '+22177000000', 'abc'])(
    'rejects invalid Senegal phone number %s',
    (input) => {
      expect(() => validator.normalizeOrThrow(input)).toThrow();
    },
  );
});
